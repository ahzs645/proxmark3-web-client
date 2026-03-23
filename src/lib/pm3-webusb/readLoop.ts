import { uartShared } from "./uartShared";
import { logLoopActivity, releaseReaderLock } from "./utils";

interface ReadLoopOptions {
  reader: ReadableStreamDefaultReader<Uint8Array>;
  shouldContinue: () => boolean;
  onReceive: () => void;
  onError: (error: unknown) => void;
}

export async function runReadLoop({
  reader,
  shouldContinue,
  onReceive,
  onError,
}: ReadLoopOptions): Promise<void> {
  try {
    let lastActivityAt = Date.now();
    let rxCount = 0;

    while (shouldContinue()) {
      const { value, done } = await reader.read();
      if (done) break;

      if (value && value.length > 0) {
        uartShared.pushRx(value);
        rxCount += value.length;
        onReceive();

        const next = logLoopActivity("RX", rxCount, lastActivityAt);
        rxCount = next.count;
        lastActivityAt = next.lastActivityAt;
      }
    }
  } catch (error) {
    onError(error);
  } finally {
    releaseReaderLock(reader);
  }
}
