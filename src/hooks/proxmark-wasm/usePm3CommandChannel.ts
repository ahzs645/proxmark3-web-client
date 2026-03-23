import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { uartShared } from "../../lib/pm3WebUSB";
import {
  getTransportManager,
  type TransportDevice,
  type TransportType,
} from "../../lib/transports";
import { getGlobalModule } from "./runtimeState";
import type { WasmModule } from "./types";
import {
  getDevicePath,
  hasExport,
  pushCommandToStdin,
  supportsStructuredCommandApi,
  toError,
  wait,
} from "./utils";

interface UsePm3CommandChannelParams {
  isReady: boolean;
  isReadyRef: MutableRefObject<boolean>;
  onErrorRef: MutableRefObject<((error: Error) => void) | undefined>;
  setActiveTransportType: Dispatch<SetStateAction<TransportType | null>>;
  setIsDeviceConnected: Dispatch<SetStateAction<boolean>>;
  transportManager: ReturnType<typeof getTransportManager>;
}

export function usePm3CommandChannel({
  isReady,
  isReadyRef,
  onErrorRef,
  setActiveTransportType,
  setIsDeviceConnected,
  transportManager,
}: UsePm3CommandChannelParams) {
  const commandQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const pendingDevicePathRef = useRef<string | null>(null);
  const pendingDeviceConnectRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    transportManager.setEventHandlers({
      onConnect: () => {
        setIsDeviceConnected(true);
        setActiveTransportType(transportManager.activeTransportType);
      },
      onDisconnect: () => {
        pendingDevicePathRef.current = null;
        setIsDeviceConnected(false);
        setActiveTransportType(null);
      },
      onError: (err) => {
        console.error("Transport error:", err);
        onErrorRef.current?.(err);
      },
    });
  }, [onErrorRef, setActiveTransportType, setIsDeviceConnected, transportManager]);

  const normalizeAndReportError = useCallback(
    (error: unknown): Error => {
      const normalized = toError(error);
      console.error("PM3 WASM command error:", normalized);
      onErrorRef.current?.(normalized);
      return normalized;
    },
    [onErrorRef],
  );

  const executeStructuredCommand = useCallback(async (module: WasmModule, command: string) => {
    if (!module.ccall) {
      throw new Error("WASM runtime does not expose ccall");
    }

    if (hasExport(module, "pm3_web_exec_opts")) {
      return (await module.ccall(
        "pm3_web_exec_opts",
        "number",
        ["string", "number", "number"],
        [command, 0, 0],
        { async: true },
      )) as number;
    }

    if (hasExport(module, "pm3_console") && hasExport(module, "pm3_get_current_dev")) {
      const devPtr = module.ccall("pm3_get_current_dev", "number", [], []) as number;
      return (await module.ccall(
        "pm3_console",
        "number",
        ["number", "string", "number", "number"],
        [devPtr, command, 0, 0],
        { async: true },
      )) as number;
    }

    throw new Error("Structured PM3 command API not available");
  }, []);

  const enqueueCommand = useCallback(
    (command: string): Promise<number | void> => {
      const run = async (): Promise<number | void> => {
        const module = getGlobalModule();
        if (!module || !isReadyRef.current) {
          throw new Error("WASM client is not ready");
        }

        const shouldUseStructuredApi =
          supportsStructuredCommandApi(module) &&
          transportManager.activeTransportType !== "webserial" &&
          pendingDevicePathRef.current !== "/dev/webserial";

        if (shouldUseStructuredApi) {
          return executeStructuredCommand(module, command);
        }

        pushCommandToStdin(command);
      };

      const queued = commandQueueRef.current.then(run, run);
      commandQueueRef.current = queued.then(
        () => undefined,
        () => undefined,
      );
      return queued;
    },
    [executeStructuredCommand, isReadyRef, transportManager],
  );

  const flushPendingDeviceConnect = useCallback(async (): Promise<void> => {
    if (!isReadyRef.current) {
      return;
    }

    while (pendingDevicePathRef.current) {
      if (pendingDeviceConnectRef.current) {
        await pendingDeviceConnectRef.current;
        continue;
      }

      const devicePath = pendingDevicePathRef.current;
      const connectPromise = enqueueCommand(`hw connect -p ${devicePath}`).then(() => {
        if (pendingDevicePathRef.current === devicePath) {
          pendingDevicePathRef.current = null;
        }
      });

      pendingDeviceConnectRef.current = connectPromise;

      try {
        await connectPromise;
      } catch (error) {
        throw normalizeAndReportError(error);
      } finally {
        pendingDeviceConnectRef.current = null;
      }
    }
  }, [enqueueCommand, isReadyRef, normalizeAndReportError]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    void flushPendingDeviceConnect().catch(() => undefined);
  }, [flushPendingDeviceConnect, isReady]);

  const sendCommand = useCallback(
    (command: string) => {
      if (!isReadyRef.current) return;
      void enqueueCommand(command).catch((error) => {
        normalizeAndReportError(error);
      });
    },
    [enqueueCommand, isReadyRef, normalizeAndReportError],
  );

  const sendInput = useCallback(
    (char: string) => {
      if (!isReady) return;
      uartShared.pushStdin(char.charCodeAt(0));
    },
    [isReady],
  );

  const sendBreak = useCallback(() => {
    if (!isReady) return;
    uartShared.pushStdin(3);
  }, [isReady]);

  const hardReset = useCallback(async (): Promise<void> => {
    console.warn("[PM3] Hard reset requested - disconnecting and reloading...");
    pendingDevicePathRef.current = null;
    pendingDeviceConnectRef.current = null;
    commandQueueRef.current = Promise.resolve();

    try {
      await transportManager.disconnect();
    } catch (e) {
      console.error("Error disconnecting during hard reset:", e);
    }
    setIsDeviceConnected(false);

    const module = getGlobalModule();
    if (module?.HEAPU32) {
      const heapU32 = module.HEAPU32;
      const rxHeadPtr = module._pm3_uart_rx_head_ptr?.();
      const rxTailPtr = module._pm3_uart_rx_tail_ptr?.();
      const txHeadPtr = module._pm3_uart_tx_head_ptr?.();
      const txTailPtr = module._pm3_uart_tx_tail_ptr?.();
      const stdinHeadPtr = module._pm3_uart_stdin_head_ptr?.();
      const stdinTailPtr = module._pm3_uart_stdin_tail_ptr?.();

      if (rxHeadPtr && rxTailPtr) {
        Atomics.store(heapU32, rxHeadPtr >> 2, 0);
        Atomics.store(heapU32, rxTailPtr >> 2, 0);
      }
      if (txHeadPtr && txTailPtr) {
        Atomics.store(heapU32, txHeadPtr >> 2, 0);
        Atomics.store(heapU32, txTailPtr >> 2, 0);
      }
      if (stdinHeadPtr && stdinTailPtr) {
        Atomics.store(heapU32, stdinHeadPtr >> 2, 0);
        Atomics.store(heapU32, stdinTailPtr >> 2, 0);
      }
      console.log("[PM3] Ring buffers cleared");
    }

    await wait(100);
    window.location.reload();
  }, [setIsDeviceConnected, transportManager]);

  const connectDevice = useCallback(
    async (transportType?: TransportType, device?: TransportDevice): Promise<boolean> => {
      const selectedType = transportType || transportManager.getDefaultTransportType();
      if (!selectedType) {
        console.error("No transport available");
        return false;
      }

      const connected = await transportManager.connect(selectedType, device);

      if (connected) {
        pendingDevicePathRef.current = getDevicePath(selectedType);
        await wait(selectedType === "webserial" ? 500 : 100);
        if (isReadyRef.current) {
          try {
            await flushPendingDeviceConnect();
          } catch {
            return false;
          }
        }
      }

      return connected;
    },
    [flushPendingDeviceConnect, isReadyRef, transportManager],
  );

  const disconnectDevice = useCallback(async (): Promise<void> => {
    pendingDevicePathRef.current = null;
    await transportManager.disconnect();
  }, [transportManager]);

  return {
    sendCommand,
    sendInput,
    sendBreak,
    hardReset,
    connectDevice,
    disconnectDevice,
  };
}
