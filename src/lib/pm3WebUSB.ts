

// Shared Ring Buffer Logic
export class UartShared {
  private heapU8!: Uint8Array;
  private heapU32!: Uint32Array;

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

  init(module: any) {
    console.log('UartShared.init called with module keys:', Object.keys(module));

    // Try to find exports in module or module.asm
    // const exports = module.asm || module;

    let heapU8 = module.HEAPU8;
    if (!heapU8 && module.wasmMemory) {
      heapU8 = new Uint8Array(module.wasmMemory.buffer);
    }

    if (!heapU8) {
      console.error('UartShared: HEAPU8 missing and no wasmMemory found');
      return;
    }

    // Helper to get export
    const getExport = (name: string) => {
      if (module[name]) return module[name];
      if (module.asm && module.asm[name]) return module.asm[name];
      if (module[`_${name}`]) return module[`_${name}`]; // Try with underscore
      return undefined;
    };

    const rxHeadPtr = getExport('pm3_uart_rx_head_ptr');
    if (!rxHeadPtr) {
      console.error('UartShared: pm3_uart_rx_head_ptr missing');
      return;
    }

    this.heapU8 = heapU8;
    this.heapU32 = new Uint32Array(this.heapU8.buffer);
    this.capacity = module._pm3_uart_rb_capacity ? module._pm3_uart_rb_capacity() : getExport('pm3_uart_rb_capacity')();

    // RX (Main -> Worker)
    this.rxHeadIdx = rxHeadPtr() >> 2;
    this.rxTailIdx = getExport('pm3_uart_rx_tail_ptr')() >> 2;
    this.rxBufByteOffset = getExport('pm3_uart_rx_buf_ptr')();

    const rxInitPtr = getExport('pm3_uart_rx_initialized_ptr');
    if (rxInitPtr) {
      this.rxInitializedIdx = rxInitPtr() >> 2;
    }

    // TX (Worker -> Main)
    this.txHeadIdx = getExport('pm3_uart_tx_head_ptr')() >> 2;
    this.txTailIdx = getExport('pm3_uart_tx_tail_ptr')() >> 2;
    this.txBufByteOffset = getExport('pm3_uart_tx_buf_ptr')();

    // Stdin (Main -> Worker)
    const stdinHeadPtr = getExport('pm3_uart_stdin_head_ptr');
    if (stdinHeadPtr) {
      this.stdinHeadIdx = stdinHeadPtr() >> 2;
      this.stdinTailIdx = getExport('pm3_uart_stdin_tail_ptr')() >> 2;
      this.stdinBufByteOffset = getExport('pm3_uart_stdin_buf_ptr')();
    } else {
      console.error('UartShared: pm3_uart_stdin_head_ptr missing! Stdin will not work.');
    }

    console.log('UartShared initialized', {
      capacity: this.capacity,
      rxHeadIdx: this.rxHeadIdx,
      rxBufOffset: this.rxBufByteOffset,
      rxInitIdx: this.rxInitializedIdx
    });
  }

  // ... (pushRx and popTx remain the same)

  pushStdin(char: number) {
    // console.log('pushStdin called', char);
    if (!this.heapU8 || this.stdinHeadIdx === undefined) {
      // console.warn('pushStdin: heap or stdinHeadIdx missing');
      return;
    }

    const cap = this.capacity;
    let head = Atomics.load(this.heapU32, this.stdinHeadIdx) >>> 0;
    const tail = Atomics.load(this.heapU32, this.stdinTailIdx) >>> 0;

    // console.log('pushStdin state', { head, tail, cap });

    let used = (head - tail) >>> 0;
    let free = cap - used;

    if (free > 0) {
      const headIdx = (head % cap) | 0;
      this.heapU8[this.stdinBufByteOffset + headIdx] = char;

      head = (head + 1) >>> 0;
      Atomics.store(this.heapU32, this.stdinHeadIdx, head);
      // console.log('pushStdin stored', char, 'new head', head);
    } else {
      // console.warn('pushStdin: buffer full');
    }
  }


  pushRx(src: Uint8Array) {
    if (!this.heapU8) return;

    const cap = this.capacity;
    let head = Atomics.load(this.heapU32, this.rxHeadIdx) >>> 0;
    const tail = Atomics.load(this.heapU32, this.rxTailIdx) >>> 0;

    let used = (head - tail) >>> 0;
    let free = cap - used;

    let srcOff = 0;
    while (srcOff < src.length && free > 0) {
      const toWrite = Math.min(free, src.length - srcOff);
      const headIdx = (head % cap) | 0;
      const first = Math.min(toWrite, cap - headIdx);

      // Copy first segment
      this.heapU8.set(
        src.subarray(srcOff, srcOff + first),
        this.rxBufByteOffset + headIdx
      );

      // Wrap-around part if needed
      if (toWrite > first) {
        this.heapU8.set(
          src.subarray(srcOff + first, srcOff + toWrite),
          this.rxBufByteOffset
        );
      }

      head = (head + toWrite) >>> 0;
      Atomics.store(this.heapU32, this.rxHeadIdx, head);

      srcOff += toWrite;
      used += toWrite;
      free = cap - used;
    }

    if (srcOff < src.length) {
      console.warn(`pushRx: dropped ${src.length - srcOff} bytes (buffer full)`);
    }
  }

  popTx(maxBytes: number, out: Uint8Array): number {
    if (!this.heapU8) return 0;

    const cap = this.capacity;
    const head = Atomics.load(this.heapU32, this.txHeadIdx) >>> 0;
    let tail = Atomics.load(this.heapU32, this.txTailIdx) >>> 0;

    let available = (head - tail) >>> 0;
    if (available === 0) return 0;
    if (available > maxBytes) available = maxBytes;

    const tailIdx = (tail % cap) | 0;
    const first = Math.min(available, cap - tailIdx);

    out.set(
      this.heapU8.subarray(
        this.txBufByteOffset + tailIdx,
        this.txBufByteOffset + tailIdx + first
      ),
      0
    );

    if (available > first) {
      out.set(
        this.heapU8.subarray(
          this.txBufByteOffset,
          this.txBufByteOffset + (available - first)
        ),
        first
      );
    }

    tail = (tail + available) >>> 0;
    Atomics.store(this.heapU32, this.txTailIdx, tail);

    return available;
  }
}

export const uartShared = new UartShared();

export class PM3WebUSB {
  private device: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  public isConnected: boolean = false;
  private readLoopRunning: boolean = false;
  private txLoopRunning: boolean = false;

  async connect(): Promise<boolean> {
    if (!('serial' in navigator)) {
      console.error('WebSerial not supported in this browser');
      return false;
    }

    try {
      this.device = await navigator.serial.requestPort();
      await this.device.open({ baudRate: 115200 });

      this.isConnected = true;
      this.readLoopRunning = true;
      this.txLoopRunning = true;

      // Initialize shared memory only when the WASM runtime is ready
      if (window.Module && window.Module.HEAPU8 && window.Module._pm3_uart_rx_head_ptr) {
        uartShared.init(window.Module);
      }

      this.startReadLoop();
      this.startTxLoop();

      return true;
    } catch (error) {
      console.error('Connection failed:', error);
      console.error('Failed to connect to device');
      return false;
    }
  }

  async disconnect() {
    this.readLoopRunning = false;
    this.txLoopRunning = false;
    this.isConnected = false;

    if (this.reader) {
      await this.reader.cancel();
      this.reader = null;
    }
    if (this.writer) {
      await this.writer.close();
      this.writer = null;
    }
    if (this.device) {
      await this.device.close();
      this.device = null;
    }
  }

  private async startReadLoop() {
    if (!this.device || !this.device.readable) return;

    try {
      this.reader = this.device.readable.getReader();

      while (this.readLoopRunning && this.device && this.isConnected) {
        const { value, done } = await this.reader.read();
        if (done) break;

        if (value && value.length > 0) {
          uartShared.pushRx(value);
        }
      }
    } catch (error) {
      console.error('Read loop error:', error);
    } finally {
      if (this.reader) {
        this.reader.releaseLock();
      }
    }
  }

  private async startTxLoop() {
    if (!this.device || !this.device.writable) return;

    try {
      this.writer = this.device.writable.getWriter();
      const tmp = new Uint8Array(4096);

      while (this.txLoopRunning && this.device && this.isConnected) {
        const n = uartShared.popTx(tmp.length, tmp);
        if (n > 0) {
          await this.writer.write(tmp.subarray(0, n));
        } else {
          // Sleep a bit to avoid busy-looping
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      }
    } catch (error) {
      console.error('Tx loop error:', error);
    } finally {
      if (this.writer) {
        this.writer.releaseLock();
      }
    }
  }

  // Legacy send method (kept for compatibility if needed, but WASM should use ring buffer)
  async send(data: Uint8Array) {
    if (!this.device || !this.device.writable) return;
    // Direct write if needed
    const writer = this.device.writable.getWriter();
    await writer.write(data);
    writer.releaseLock();
  }
}

// Create global instance
const pm3WebUSB = new PM3WebUSB();

// Expose to window for debugging/legacy access
// @ts-expect-error Window extension
window.pm3WebUSB = pm3WebUSB;

export default pm3WebUSB;
