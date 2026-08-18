import { PM3_USB_PRODUCT_ID, PM3_USB_VENDOR_ID, type FirmwareIo } from "./protocol";

const OPEN_OPTIONS: SerialOptions = { baudRate: 115200, bufferSize: 64 * 1024 };
const OPEN_TIMEOUT_MS = 5_000;

async function openPort(port: SerialPort): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const opening = port.open(OPEN_OPTIONS);

  try {
    await Promise.race([
      opening,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          timedOut = true;
          reject(
            new Error(
              "Timed out opening the Proxmark3 serial port. Reconnect the reader and try again",
            ),
          );
        }, OPEN_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    if (timedOut) {
      // Web Serial does not provide an abort signal for port.open(). If Chrome
      // eventually completes a stale open after our timeout, close it so it
      // cannot silently retain the device behind the offline UI.
      void opening.then(() => port.close()).catch(() => undefined);
    }
  }
}

export class FirmwareSerialConnection implements FirmwareIo {
  private readonly port: SerialPort;
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private reading = true;
  private readonly queuedChunks: Uint8Array[] = [];
  private readonly readWaiters: Array<{
    resolve: (data: Uint8Array) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = [];

  private constructor(
    port: SerialPort,
    reader: ReadableStreamDefaultReader<Uint8Array>,
    writer: WritableStreamDefaultWriter<Uint8Array>,
  ) {
    this.port = port;
    this.reader = reader;
    this.writer = writer;
    void this.runReadLoop();
  }

  static async open(port: SerialPort): Promise<FirmwareSerialConnection> {
    if (port.readable || port.writable) {
      if (port.readable?.locked || port.writable?.locked) {
        throw new Error("The Proxmark3 serial port is still in use by another tab or app");
      }

      // The normal terminal can hand us an already-open port after releasing
      // its reader/writer locks. Reuse those streams directly: closing and
      // immediately reopening the same Web Serial object races Chrome's
      // asynchronous device teardown and commonly fails with "port is already
      // open" even though no stream is owned anymore.
      if (port.readable && port.writable) {
        return new FirmwareSerialConnection(
          port,
          port.readable.getReader(),
          port.writable.getWriter(),
        );
      }

      await port.close();
    }
    await openPort(port);
    if (!port.readable || !port.writable) throw new Error("Serial streams are unavailable");
    if (port.setSignals) {
      try {
        await port.setSignals({ dataTerminalReady: true, requestToSend: true });
      } catch {
        // Some CDC bridges do not expose control signals. Data transfer still
        // works, as it does in the normal WebSerial transport.
      }
    }
    return new FirmwareSerialConnection(port, port.readable.getReader(), port.writable.getWriter());
  }

  async write(data: Uint8Array): Promise<void> {
    await this.writer.ready;
    await this.writer.write(data);
  }

  async readChunk(timeoutMs: number): Promise<Uint8Array> {
    const queued = this.queuedChunks.shift();
    if (queued) return queued;
    if (!this.reading) throw new Error("Reader disconnected");

    return new Promise<Uint8Array>((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        timeout: setTimeout(() => {
          const index = this.readWaiters.indexOf(waiter);
          if (index >= 0) this.readWaiters.splice(index, 1);
          reject(new Error("Timed out waiting for the reader"));
        }, timeoutMs),
      };
      this.readWaiters.push(waiter);
    });
  }

  private async runReadLoop(): Promise<void> {
    try {
      while (this.reading) {
        const result = await this.reader.read();
        if (result.done) throw new Error("Reader disconnected");
        if (!result.value || result.value.length === 0) continue;
        const waiter = this.readWaiters.shift();
        if (waiter) {
          clearTimeout(waiter.timeout);
          waiter.resolve(result.value);
        } else {
          this.queuedChunks.push(result.value);
        }
      }
    } catch (caught) {
      if (!this.reading) return;
      this.reading = false;
      const error = caught instanceof Error ? caught : new Error(String(caught));
      for (const waiter of this.readWaiters.splice(0)) {
        clearTimeout(waiter.timeout);
        waiter.reject(error);
      }
    }
  }

  async close(): Promise<void> {
    this.reading = false;
    for (const waiter of this.readWaiters.splice(0)) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error("Reader connection closed"));
    }
    try {
      await this.reader.cancel();
    } catch {
      // The device may already have reset and invalidated the reader.
    }
    try {
      this.reader.releaseLock();
    } catch {
      // Ignore an already-released lock.
    }
    try {
      await this.writer.close();
    } catch {
      try {
        this.writer.releaseLock();
      } catch {
        // Ignore an already-released lock.
      }
    }
    try {
      await this.port.close();
    } catch {
      // A reset can close the underlying port before cleanup runs.
    }
  }
}

function isPm3Port(port: SerialPort): boolean {
  const info = port.getInfo();
  return info.usbVendorId === PM3_USB_VENDOR_ID && info.usbProductId === PM3_USB_PRODUCT_ID;
}

async function tryAuthorizedPorts(): Promise<FirmwareSerialConnection | null> {
  const ports = await navigator.serial.getPorts();
  let busyError: Error | null = null;
  let lastOpenError: Error | null = null;
  for (const port of ports.filter(isPm3Port)) {
    try {
      return await FirmwareSerialConnection.open(port);
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error(String(caught));
      if (error.message.includes("still in use")) busyError = error;
      else lastOpenError = error;
      // Chrome may retain a stale pre-reset port alongside the live one.
    }
  }
  if (busyError) throw busyError;
  if (lastOpenError)
    throw new Error(`Could not open the authorized Proxmark3 port: ${lastOpenError.message}`);
  return null;
}

export async function openFirmwareSerial(
  requestIfMissing = true,
  preferredPort: SerialPort | null = null,
): Promise<FirmwareSerialConnection> {
  if (!("serial" in navigator)) throw new Error("Firmware updates require Chrome Web Serial");
  if (preferredPort) {
    try {
      return await FirmwareSerialConnection.open(preferredPort);
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error(String(caught));
      if (error.message.includes("still in use")) throw error;
      // The device may have re-enumerated between disconnect and reopen. Fall
      // through to the authorized-port inventory in that case.
    }
  }
  const authorized = await tryAuthorizedPorts();
  if (authorized) return authorized;
  if (!requestIfMissing) throw new Error("The Proxmark3 serial port is not available");
  const port = await navigator.serial.requestPort({
    filters: [{ usbVendorId: PM3_USB_VENDOR_ID, usbProductId: PM3_USB_PRODUCT_ID }],
  });
  return FirmwareSerialConnection.open(port);
}

export async function reconnectFirmwareSerial(
  attempts: number,
  delayMs: number,
): Promise<FirmwareSerialConnection> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      const connection = await tryAuthorizedPorts();
      if (connection) return connection;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    lastError instanceof Error
      ? `Reader did not reconnect: ${lastError.message}`
      : "Reader did not reconnect. Hold the button while reconnecting USB, then try again.",
  );
}
