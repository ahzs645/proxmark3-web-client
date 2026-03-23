export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function releaseReaderLock(reader: ReadableStreamDefaultReader<Uint8Array> | null) {
  if (!reader) return;

  try {
    reader.releaseLock();
  } catch {
    // Ignore release errors during shutdown
  }
}

export function releaseWriterLock(writer: WritableStreamDefaultWriter<Uint8Array> | null) {
  if (!writer) return;

  try {
    writer.releaseLock();
  } catch {
    // Ignore release errors during shutdown
  }
}

export async function safeCancelReader(reader: ReadableStreamDefaultReader<Uint8Array> | null) {
  if (!reader) return;

  try {
    await reader.cancel();
  } catch {
    // Ignore cancel errors during shutdown
  }
}

export async function safeCloseWriter(writer: WritableStreamDefaultWriter<Uint8Array> | null) {
  if (!writer) return;

  try {
    await writer.close();
  } catch {
    // Ignore close errors during shutdown
  }
}

export async function safeClosePort(port: SerialPort | null) {
  if (!port) return;

  try {
    await port.close();
  } catch {
    // Ignore close errors during shutdown
  }
}

export function logLoopActivity(
  direction: "RX" | "TX",
  count: number,
  lastActivityAt: number,
): { count: number; lastActivityAt: number } {
  const now = Date.now();

  if (now - lastActivityAt <= 1000) {
    return { count, lastActivityAt };
  }

  console.debug(
    `[${direction}] ${count} bytes ${direction === "RX" ? "received" : "sent"} in last second`,
  );
  return { count: 0, lastActivityAt: now };
}
