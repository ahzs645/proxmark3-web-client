import { uartShared } from "./uartShared";
import { logLoopActivity, releaseWriterLock, sleep } from "./utils";

interface TxLoopOptions {
  writer: WritableStreamDefaultWriter<Uint8Array>;
  shouldContinue: () => boolean;
  onTransmit: () => void;
  onError: (error: unknown) => void;
  idleDelayMs?: number;
}

export async function runTxLoop({
  writer,
  shouldContinue,
  onTransmit,
  onError,
  idleDelayMs = 1,
}: TxLoopOptions): Promise<void> {
  const tmp = new Uint8Array(4096);

  try {
    let lastActivityAt = Date.now();
    let txCount = 0;

    while (shouldContinue()) {
      const n = uartShared.popTx(tmp.length, tmp);
      if (n > 0) {
        await writer.write(tmp.subarray(0, n));
        txCount += n;
        onTransmit();

        const next = logLoopActivity("TX", txCount, lastActivityAt);
        txCount = next.count;
        lastActivityAt = next.lastActivityAt;
      } else {
        await sleep(idleDelayMs);
      }
    }
  } catch (error) {
    onError(error);
  } finally {
    releaseWriterLock(writer);
  }
}
