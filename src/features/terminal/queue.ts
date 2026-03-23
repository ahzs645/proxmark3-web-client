import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { Terminal as XTerm } from "@xterm/xterm";

export function useTerminalWriteQueue(xtermRef: MutableRefObject<XTerm | null>) {
  const pendingWriteRef = useRef("");
  const flushHandleRef = useRef<number | null>(null);

  const flushPendingWrites = useCallback(() => {
    if (flushHandleRef.current !== null) {
      cancelAnimationFrame(flushHandleRef.current);
      flushHandleRef.current = null;
    }

    if (!pendingWriteRef.current) {
      return;
    }

    const pending = pendingWriteRef.current;
    pendingWriteRef.current = "";
    xtermRef.current?.write(pending);
  }, [xtermRef]);

  const clearPendingWrites = useCallback(() => {
    pendingWriteRef.current = "";
    if (flushHandleRef.current !== null) {
      cancelAnimationFrame(flushHandleRef.current);
      flushHandleRef.current = null;
    }
  }, []);

  const scheduleWrite = useCallback(
    (data: string) => {
      pendingWriteRef.current += data;
      if (flushHandleRef.current !== null) {
        return;
      }

      flushHandleRef.current = requestAnimationFrame(() => {
        flushHandleRef.current = null;
        flushPendingWrites();
      });
    },
    [flushPendingWrites],
  );

  useEffect(() => {
    return () => {
      clearPendingWrites();
    };
  }, [clearPendingWrites]);

  return {
    scheduleWrite,
    clearPendingWrites,
    flushPendingWrites,
  };
}
