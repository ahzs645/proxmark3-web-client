import { getModuleExport } from "./moduleAccess";
import type { Pm3BrowserModule } from "./types";

export class UartShared {
  // Store the module reference to get fresh heap views on each operation
  // This is CRITICAL because ALLOW_MEMORY_GROWTH can reallocate the heap
  private module: Pm3BrowserModule | null = null;

  private capacity!: number;

  private rxHeadIdx!: number;
  private rxTailIdx!: number;
  private rxBufByteOffset!: number;
  private rxInitializedIdx!: number;

  private txHeadIdx!: number;
  private txTailIdx!: number;
  private txBufByteOffset!: number;

  private stdinHeadIdx!: number;
  private stdinTailIdx!: number;
  private stdinBufByteOffset!: number;

  // Get fresh heap views - must be called on every operation due to memory growth
  private getHeap(): { heapU8: Uint8Array; heapU32: Uint32Array } | null {
    if (!this.module) return null;
    // Always get fresh references from module - they auto-update on memory growth
    const heapU8 = this.module.HEAPU8;
    const heapU32 = this.module.HEAPU32;
    if (!heapU8 || !heapU32) return null;
    return { heapU8, heapU32 };
  }

  init(module: Pm3BrowserModule) {
    console.log("UartShared.init called with module keys:", Object.keys(module));

    // Store module reference for later heap access
    this.module = module;

    let heapU8 = module.HEAPU8;
    if (!heapU8 && module.wasmMemory) {
      heapU8 = new Uint8Array(module.wasmMemory.buffer);
    }

    if (!heapU8) {
      console.error("UartShared: HEAPU8 missing and no wasmMemory found");
      return;
    }

    const rxHeadPtr = getModuleExport<() => number>(module, "pm3_uart_rx_head_ptr");
    if (!rxHeadPtr) {
      console.error("UartShared: pm3_uart_rx_head_ptr missing");
      return;
    }

    const capacityGetter =
      module._pm3_uart_rb_capacity ?? getModuleExport<() => number>(module, "pm3_uart_rb_capacity");
    if (!capacityGetter) {
      console.error("UartShared: pm3_uart_rb_capacity missing");
      return;
    }

    this.capacity = capacityGetter();

    // RX (Main -> Worker)
    this.rxHeadIdx = rxHeadPtr() >> 2;
    this.rxTailIdx = getModuleExport<() => number>(module, "pm3_uart_rx_tail_ptr")!() >> 2;
    this.rxBufByteOffset = getModuleExport<() => number>(module, "pm3_uart_rx_buf_ptr")!();

    const rxInitPtr = getModuleExport<() => number>(module, "pm3_uart_rx_initialized_ptr");
    if (rxInitPtr) {
      this.rxInitializedIdx = rxInitPtr() >> 2;
    }

    // TX (Worker -> Main)
    this.txHeadIdx = getModuleExport<() => number>(module, "pm3_uart_tx_head_ptr")!() >> 2;
    this.txTailIdx = getModuleExport<() => number>(module, "pm3_uart_tx_tail_ptr")!() >> 2;
    this.txBufByteOffset = getModuleExport<() => number>(module, "pm3_uart_tx_buf_ptr")!();

    // Stdin (Main -> Worker)
    const stdinHeadPtr = getModuleExport<() => number>(module, "pm3_uart_stdin_head_ptr");
    if (stdinHeadPtr) {
      this.stdinHeadIdx = stdinHeadPtr() >> 2;
      this.stdinTailIdx = getModuleExport<() => number>(module, "pm3_uart_stdin_tail_ptr")!() >> 2;
      this.stdinBufByteOffset = getModuleExport<() => number>(module, "pm3_uart_stdin_buf_ptr")!();
    } else {
      console.error("UartShared: pm3_uart_stdin_head_ptr missing! Stdin will not work.");
    }

    console.log("UartShared initialized", {
      capacity: this.capacity,
      rxHeadIdx: this.rxHeadIdx,
      rxBufOffset: this.rxBufByteOffset,
      rxInitIdx: this.rxInitializedIdx,
    });
  }

  pushStdin(char: number) {
    const heap = this.getHeap();
    if (!heap || this.stdinHeadIdx === undefined) {
      return;
    }

    const { heapU8, heapU32 } = heap;
    const cap = this.capacity;
    let head = Atomics.load(heapU32, this.stdinHeadIdx) >>> 0;
    const tail = Atomics.load(heapU32, this.stdinTailIdx) >>> 0;

    const used = (head - tail) >>> 0;
    const free = cap - used;

    if (free > 0) {
      const headIdx = (head % cap) | 0;
      heapU8[this.stdinBufByteOffset + headIdx] = char;

      head = (head + 1) >>> 0;
      Atomics.store(heapU32, this.stdinHeadIdx, head);
    }
  }

  /**
   * Copy as much device data as currently fits in the WASM RX ring buffer.
   *
   * Returning the number of copied bytes lets asynchronous transports apply
   * backpressure instead of dropping the remainder of a serial packet.
   */
  pushRx(src: Uint8Array, warnOnPartial = true): number {
    const heap = this.getHeap();
    if (!heap) return 0;

    const { heapU8, heapU32 } = heap;
    const cap = this.capacity;
    let head = Atomics.load(heapU32, this.rxHeadIdx) >>> 0;
    const tail = Atomics.load(heapU32, this.rxTailIdx) >>> 0;

    let used = (head - tail) >>> 0;
    let free = cap - used;

    let srcOff = 0;
    while (srcOff < src.length && free > 0) {
      const toWrite = Math.min(free, src.length - srcOff);
      const headIdx = (head % cap) | 0;
      const first = Math.min(toWrite, cap - headIdx);

      heapU8.set(src.subarray(srcOff, srcOff + first), this.rxBufByteOffset + headIdx);

      if (toWrite > first) {
        heapU8.set(src.subarray(srcOff + first, srcOff + toWrite), this.rxBufByteOffset);
      }

      head = (head + toWrite) >>> 0;
      Atomics.store(heapU32, this.rxHeadIdx, head);

      srcOff += toWrite;
      used += toWrite;
      free = cap - used;
    }

    if (warnOnPartial && srcOff < src.length) {
      console.warn(`pushRx: dropped ${src.length - srcOff} bytes (buffer full)`);
    }

    return srcOff;
  }

  popTx(maxBytes: number, out: Uint8Array): number {
    const heap = this.getHeap();
    if (!heap) return 0;

    const { heapU8, heapU32 } = heap;
    const cap = this.capacity;
    const head = Atomics.load(heapU32, this.txHeadIdx) >>> 0;
    let tail = Atomics.load(heapU32, this.txTailIdx) >>> 0;

    let available = (head - tail) >>> 0;
    if (available === 0) return 0;
    if (available > maxBytes) available = maxBytes;

    const tailIdx = (tail % cap) | 0;
    const first = Math.min(available, cap - tailIdx);

    out.set(
      heapU8.subarray(this.txBufByteOffset + tailIdx, this.txBufByteOffset + tailIdx + first),
      0,
    );

    if (available > first) {
      out.set(
        heapU8.subarray(this.txBufByteOffset, this.txBufByteOffset + (available - first)),
        first,
      );
    }

    tail = (tail + available) >>> 0;
    Atomics.store(heapU32, this.txTailIdx, tail);

    return available;
  }
}

export const uartShared = new UartShared();
