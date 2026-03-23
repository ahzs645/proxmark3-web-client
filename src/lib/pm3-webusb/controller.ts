import { canInitSharedUart, getPm3Module } from "./moduleAccess";
import { runReadLoop } from "./readLoop";
import { startHealthMonitor } from "./healthMonitor";
import { runTxLoop } from "./txLoop";
import { uartShared } from "./uartShared";
import { safeCancelReader, safeClosePort, safeCloseWriter } from "./utils";

export class PM3WebUSB {
  private device: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  public isConnected = false;
  private readLoopRunning = false;
  private txLoopRunning = false;

  // Health monitoring
  private lastRxTime = 0;
  private lastTxTime = 0;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  public onUnresponsive?: () => void;

  async connect(): Promise<boolean> {
    if (!("serial" in navigator)) {
      console.error("WebSerial not supported in this browser");
      return false;
    }

    try {
      this.device = await navigator.serial.requestPort();
      await this.device.open({ baudRate: 115200 });

      this.isConnected = true;
      this.readLoopRunning = true;
      this.txLoopRunning = true;
      this.lastRxTime = Date.now();
      this.lastTxTime = Date.now();

      this.initSharedUartIfReady();

      void this.startReadLoop();
      void this.startTxLoop();
      this.startHealthCheck();

      return true;
    } catch (error) {
      console.error("Connection failed:", error);
      console.error("Failed to connect to device");
      return false;
    }
  }

  async disconnect() {
    this.readLoopRunning = false;
    this.txLoopRunning = false;
    this.isConnected = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    const reader = this.reader;
    const writer = this.writer;
    const device = this.device;

    this.reader = null;
    this.writer = null;
    this.device = null;

    await safeCancelReader(reader);
    await safeCloseWriter(writer);
    await safeClosePort(device);
  }

  private initSharedUartIfReady() {
    const module = getPm3Module();
    if (canInitSharedUart(module)) {
      uartShared.init(module);
    }
  }

  private startHealthCheck() {
    this.healthCheckInterval = startHealthMonitor({
      isConnected: () => this.isConnected,
      getLastRxTime: () => this.lastRxTime,
      getLastTxTime: () => this.lastTxTime,
      onUnresponsive: this.onUnresponsive,
    });
  }

  private async startReadLoop() {
    if (!this.device?.readable) return;

    this.reader = this.device.readable.getReader();
    await runReadLoop({
      reader: this.reader,
      shouldContinue: () => this.readLoopRunning && Boolean(this.device) && this.isConnected,
      onReceive: () => {
        this.lastRxTime = Date.now();
      },
      onError: (error) => {
        console.error("Read loop error:", error);
      },
    });
  }

  private async startTxLoop() {
    if (!this.device?.writable) return;

    this.writer = this.device.writable.getWriter();
    await runTxLoop({
      writer: this.writer,
      shouldContinue: () => this.txLoopRunning && Boolean(this.device) && this.isConnected,
      onTransmit: () => {
        this.lastTxTime = Date.now();
      },
      onError: (error) => {
        console.error("Tx loop error:", error);
      },
      idleDelayMs: 1,
    });
  }

  // Legacy send method (kept for compatibility if needed, but WASM should use ring buffer)
  async send(data: Uint8Array) {
    if (!this.device?.writable) return;

    const writer = this.device.writable.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }
}
