/**
 * WebSerial Transport - Browser-based serial communication
 * Uses the Web Serial API available in Chrome, Edge, and other Chromium-based browsers
 */

import { uartShared } from "../pm3WebUSB";
import type { Transport, TransportType, TransportDevice, TransportEventHandlers } from "./types";

const DISCONNECT_STEP_TIMEOUT_MS = 2_000;

async function settleDisconnectStep(operation: Promise<unknown>): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      operation.catch(() => undefined),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, DISCONNECT_STEP_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** Read errors after which the port stays open and can be read again (WebSerial spec). */
const NON_FATAL_READ_ERRORS = new Set([
  "BufferOverrunError",
  "BreakError",
  "FramingError",
  "ParityError",
]);

export class WebSerialTransport implements Transport {
  readonly type: TransportType = "webserial";

  private device: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private _isConnected: boolean = false;
  private readLoopRunning: boolean = false;
  private txLoopRunning: boolean = false;
  private eventHandlers: TransportEventHandlers = {};

  private async tryOpenPort(port: SerialPort): Promise<boolean> {
    try {
      // PM3 bulk replies (sample downloads, dumps, traces) arrive in bursts of
      // protocol frames larger than Chrome's small default serial buffer. A
      // larger native buffer prevents bytes being discarded before the JS
      // read loop can move them into the WASM ring buffer.
      await port.open({ baudRate: 115200, bufferSize: 64 * 1024 });
      this.device = port;
      port.addEventListener("disconnect", this.onPortLost);
      return true;
    } catch {
      return false;
    }
  }

  private async pushRxWithBackpressure(value: Uint8Array): Promise<void> {
    let offset = 0;
    let waitingSince = 0;
    let reportedWait = false;

    while (offset < value.length && this.readLoopRunning && this._isConnected) {
      const written = uartShared.pushRx(value.subarray(offset), false);
      offset += written;

      if (offset >= value.length) {
        if (reportedWait) {
          console.info(
            `[WebSerial] RX backpressure cleared after ${Math.round(performance.now() - waitingSince)} ms`,
          );
        }
        return;
      }

      if (waitingSince === 0) {
        waitingSince = performance.now();
      } else if (!reportedWait && performance.now() - waitingSince >= 100) {
        reportedWait = true;
        console.warn(
          `[WebSerial] RX ring buffer full; preserving ${value.length - offset} queued bytes`,
        );
      }

      // Pausing the WebSerial read loop leaves subsequent bytes in the
      // browser/OS stream, providing lossless backpressure until WASM drains
      // enough of its ring buffer for this chunk.
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    if (offset < value.length && this._isConnected) {
      throw new Error(`WebSerial RX stopped with ${value.length - offset} unread bytes`);
    }
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Return the exact authorized port object currently owned by this transport.
   * Firmware update uses this before disconnecting so it can reopen the same
   * device without racing Web Serial rediscovery or showing another chooser.
   */
  getSerialPort(): SerialPort | null {
    return this.device;
  }

  isAvailable(): boolean {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  async listDevices(): Promise<TransportDevice[]> {
    // WebSerial doesn't support listing devices without user interaction
    // The device picker is shown during connect()
    return [];
  }

  // oxlint-disable-next-line @typescript-eslint/no-unused-vars
  async connect(_device?: TransportDevice): Promise<boolean> {
    if (!this.isAvailable()) {
      console.error("WebSerial not supported in this browser");
      return false;
    }

    try {
      // A reader reset can leave Chrome with both a stale pre-reset port and a
      // live post-reset port. Try every authorized entry and keep the first one
      // that opens instead of forcing the native picker when there are several.
      const authorizedPorts = await navigator.serial.getPorts();
      for (const port of authorizedPorts) {
        if (await this.tryOpenPort(port)) break;
      }

      if (!this.device) {
        const selectedPort = await navigator.serial.requestPort();
        if (!(await this.tryOpenPort(selectedPort))) {
          throw new Error("Failed to open the selected serial port");
        }
      }

      this._isConnected = true;

      // Initialize shared memory if WASM runtime is ready
      if (window.Module && window.Module.HEAPU8 && window.Module._pm3_uart_rx_head_ptr) {
        uartShared.init(window.Module);
      }

      this.eventHandlers.onConnect?.();
      return true;
    } catch (error) {
      console.error("WebSerial connection failed:", error);
      this.eventHandlers.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * The port vanished (cable pulled, reader reset). Chrome fires `disconnect`
   * on the port and fails the pending read; either one lands here. Without it
   * the transport kept reporting a live link the client could no longer reach.
   */
  private readonly onPortLost = () => {
    if (!this._isConnected) return;
    console.warn("[WebSerial] serial port lost");
    void this.disconnect("lost");
  };

  async disconnect(reason?: "lost"): Promise<void> {
    this.stopReadLoop();
    this.stopTxLoop();
    this._isConnected = false;

    const reader = this.reader;
    this.reader = null;
    if (reader) {
      await settleDisconnectStep(reader.cancel());
      try {
        reader.releaseLock();
      } catch {
        // The read loop may already have released it.
      }
    }

    const writer = this.writer;
    this.writer = null;
    if (writer) {
      // A bootloader cannot answer a normal PM3 command. Abort rather than
      // gracefully draining a stale command, which can otherwise hold the
      // serial port forever while the firmware updater waits for ownership.
      await settleDisconnectStep(writer.abort());
      try {
        writer.releaseLock();
      } catch {
        // The TX loop may already have released it.
      }
    }

    if (this.device) {
      this.device.removeEventListener("disconnect", this.onPortLost);
      await settleDisconnectStep(this.device.close());
      this.device = null;
    }

    this.eventHandlers.onDisconnect?.(reason);
  }

  startReadLoop(): void {
    if (this.readLoopRunning) return;
    this.readLoopRunning = true;
    void this.runReadLoop();
  }

  stopReadLoop(): void {
    this.readLoopRunning = false;
  }

  private async runReadLoop(): Promise<void> {
    if (!this.device || !this.device.readable) return;
    let restart = false;

    try {
      this.reader = this.device.readable.getReader();

      while (this.readLoopRunning && this.device && this._isConnected) {
        const { value, done } = await this.reader.read();
        if (done) {
          // A stream that ends while we still want data means the port went away.
          if (this.readLoopRunning) this.onPortLost();
          break;
        }

        if (value && value.length > 0) {
          await this.pushRxWithBackpressure(value);
          this.eventHandlers.onData?.(value);
        }
      }
    } catch (error) {
      if (this.readLoopRunning && this._isConnected) {
        // Overruns and line errors leave the port open with a fresh readable
        // stream; anything else means the device is gone.
        restart = NON_FATAL_READ_ERRORS.has((error as { name?: string } | null)?.name ?? "");
        if (restart) {
          console.warn("WebSerial read error, resuming:", error);
        } else {
          console.error("WebSerial read loop error:", error);
          this.onPortLost();
        }
      }
    } finally {
      if (this.reader) {
        try {
          this.reader.releaseLock();
        } catch {
          // Ignore
        }
      }
    }
    if (restart && this.readLoopRunning && this._isConnected) void this.runReadLoop();
  }

  startTxLoop(): void {
    if (this.txLoopRunning) return;
    this.txLoopRunning = true;
    void this.runTxLoop();
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
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      }
    } catch (error) {
      if (this.txLoopRunning && this._isConnected) {
        console.error("WebSerial TX loop error:", error);
        this.onPortLost();
      }
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
    return "WebSerial (USB)";
  }

  getDescription(): string {
    return "Connect via USB using browser WebSerial API";
  }
}

export default WebSerialTransport;
