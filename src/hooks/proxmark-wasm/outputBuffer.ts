import { useCallback, useEffect, useRef, type MutableRefObject } from "react";

export function useBufferedOutput(onOutputRef: MutableRefObject<(text: string) => void>) {
  const outputBufferRef = useRef("");
  const outputFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushOutput = useCallback(() => {
    if (outputFlushTimerRef.current) {
      clearTimeout(outputFlushTimerRef.current);
      outputFlushTimerRef.current = null;
    }

    if (outputBufferRef.current) {
      onOutputRef.current(outputBufferRef.current);
      outputBufferRef.current = "";
    }
  }, [onOutputRef]);

  const scheduleOutputFlush = useCallback(
    (delayMs: number = 16) => {
      if (outputFlushTimerRef.current) {
        return;
      }

      outputFlushTimerRef.current = setTimeout(() => {
        outputFlushTimerRef.current = null;
        flushOutput();
      }, delayMs);
    },
    [flushOutput],
  );

  useEffect(() => {
    const flushInterval = setInterval(() => {
      if (outputBufferRef.current) {
        flushOutput();
      }
    }, 100);

    return () => {
      clearInterval(flushInterval);
      if (outputFlushTimerRef.current) {
        clearTimeout(outputFlushTimerRef.current);
        outputFlushTimerRef.current = null;
      }
    };
  }, [flushOutput]);

  return {
    outputBufferRef,
    flushOutput,
    scheduleOutputFlush,
  };
}
