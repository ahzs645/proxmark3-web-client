import { describe, expect, it, vi } from "vite-plus/test";
import type { Pm3BrowserModule } from "./types";
import { UartShared } from "./uartShared";

function createModule(capacity = 8) {
  const memory = new SharedArrayBuffer(256);
  const heapU8 = new Uint8Array(memory);
  const heapU32 = new Uint32Array(memory);
  const pointers = {
    rxHead: 0,
    rxTail: 4,
    rxInitialized: 8,
    txHead: 12,
    txTail: 16,
    stdinHead: 20,
    stdinTail: 24,
    rxBuffer: 64,
    txBuffer: 96,
    stdinBuffer: 128,
  };

  const module = {
    HEAPU8: heapU8,
    HEAPU32: heapU32,
    _pm3_uart_rb_capacity: () => capacity,
    _pm3_uart_rx_head_ptr: () => pointers.rxHead,
    _pm3_uart_rx_tail_ptr: () => pointers.rxTail,
    _pm3_uart_rx_buf_ptr: () => pointers.rxBuffer,
    _pm3_uart_rx_initialized_ptr: () => pointers.rxInitialized,
    _pm3_uart_tx_head_ptr: () => pointers.txHead,
    _pm3_uart_tx_tail_ptr: () => pointers.txTail,
    _pm3_uart_tx_buf_ptr: () => pointers.txBuffer,
    _pm3_uart_stdin_head_ptr: () => pointers.stdinHead,
    _pm3_uart_stdin_tail_ptr: () => pointers.stdinTail,
    _pm3_uart_stdin_buf_ptr: () => pointers.stdinBuffer,
  } as unknown as Pm3BrowserModule;

  return { heapU8, heapU32, module, pointers };
}

describe("UartShared RX writes", () => {
  it("reports a partial write instead of hiding dropped bytes", () => {
    const { heapU8, module, pointers } = createModule(4);
    const uart = new UartShared();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    uart.init(module);

    const written = uart.pushRx(Uint8Array.of(1, 2, 3, 4, 5, 6), false);

    expect(written).toBe(4);
    expect(Array.from(heapU8.slice(pointers.rxBuffer, pointers.rxBuffer + 4))).toEqual([
      1, 2, 3, 4,
    ]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("continues a packet losslessly after the consumer frees ring capacity", () => {
    const { heapU8, heapU32, module, pointers } = createModule(4);
    const uart = new UartShared();
    uart.init(module);
    const packet = Uint8Array.of(10, 11, 12, 13, 14, 15);

    const first = uart.pushRx(packet, false);
    Atomics.store(heapU32, pointers.rxTail >> 2, 2);
    const second = uart.pushRx(packet.subarray(first), false);

    expect(first).toBe(4);
    expect(second).toBe(2);
    expect(Array.from(heapU8.slice(pointers.rxBuffer, pointers.rxBuffer + 4))).toEqual([
      14, 15, 12, 13,
    ]);
    expect(Atomics.load(heapU32, pointers.rxHead >> 2)).toBe(6);
  });
});
