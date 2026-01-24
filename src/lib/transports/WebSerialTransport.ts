/**
 * WebSerial Transport - Browser-based serial communication
 * Uses the Web Serial API available in Chrome, Edge, and other Chromium-based browsers
 */

import { uartShared } from '../pm3WebUSB';
import type { Transport, TransportType, TransportDevice, TransportEventHandlers } from './types';

export class WebSerialTransport implements Transport {
  readonly type: TransportType = 'webserial';

  private device: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private _isConnected: boolean = false;
  private readLoopRunning: boolean = false;
  private txLoopRunning: boolean = false;
  private eventHandlers: TransportEventHandlers = {};

  get isConnected(): boolean {
    return this._isConnected;
  }

  isAvailable(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  async listDevices(): Promise<TransportDevice[]> {
    // WebSerial doesn't support listing devices without user interaction
    // The device picker is shown during connect()
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async connect(_device?: TransportDevice): Promise<boolean> {
    if (!this.isAvailable()) {
      console.error('WebSerial not supported in this browser');
      return false;
    }

    try {
      // WebSerial always shows a picker - we can't pre-select a device
      this.device = await navigator.serial.requestPort();
      await this.device.open({ baudRate: 115200 });

      this._isConnected = true;

      // Initialize shared memory if WASM runtime is ready
      if (window.Module && window.Module.HEAPU8 && window.Module._pm3_uart_rx_head_ptr) {
        uartShared.init(window.Module);
      }

      this.eventHandlers.onConnect?.();
      return true;
    } catch (error) {
      console.error('WebSerial connection failed:', error);
      this.eventHandlers.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.stopReadLoop();
    this.stopTxLoop();
    this._isConnected = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // Ignore cancel errors
      }
      this.reader = null;
    }

    if (this.writer) {
      try {
        await this.writer.close();
      } catch {
        // Ignore close errors
      }
      this.writer = null;
    }

    if (this.device) {
      try {
        await this.device.close();
      } catch {
        // Ignore close errors
      }
      this.device = null;
    }

    this.eventHandlers.onDisconnect?.();
  }

  startReadLoop(): void {
    if (this.readLoopRunning) return;
    this.readLoopRunning = true;
    this.runReadLoop();
  }

  stopReadLoop(): void {
    this.readLoopRunning = false;
  }

  private async runReadLoop(): Promise<void> {
    if (!this.device || !this.device.readable) return;

    try {
      this.reader = this.device.readable.getReader();

      while (this.readLoopRunning && this.device && this._isConnected) {
        const { value, done } = await this.reader.read();
        if (done) break;

        if (value && value.length > 0) {
          uartShared.pushRx(value);
          this.eventHandlers.onData?.(value);
        }
      }
    } catch (error) {
      console.error('WebSerial read loop error:', error);
      this.eventHandlers.onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      if (this.reader) {
        try {
          this.reader.releaseLock();
        } catch {
          // Ignore
        }
      }
    }
  }

  startTxLoop(): void {
    if (this.txLoopRunning) return;
    this.txLoopRunning = true;
    this.runTxLoop();
  }

  stopTxLoop(): void {
    this.txLoopRunning = false;
  }

  private async runTxLoop(): Promise<void> {
    if (!this.device || !this.device.writable) return;

    try {
      this.writer = this.device.writable.getWriter();
      const tmp = new Uint8Array(4096);

      while (this.txLoopRunning && this.device && this._isConnected) {
        const n = uartShared.popTx(tmp.length, tmp);
        if (n > 0) {
          await this.writer.write(tmp.subarray(0, n));
        } else {
          // Sleep a bit to avoid busy-looping
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      }
    } catch (error) {
      console.error('WebSerial TX loop error:', error);
      this.eventHandlers.onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      if (this.writer) {
        try {
          this.writer.releaseLock();
        } catch {
          // Ignore
        }
      }
    }
  }

  setEventHandlers(handlers: TransportEventHandlers): void {
    this.eventHandlers = handlers;
  }

  getName(): string {
    return 'WebSerial (USB)';
  }

  getDescription(): string {
    return 'Connect via USB using browser WebSerial API';
  }
}

export default WebSerialTransport;
