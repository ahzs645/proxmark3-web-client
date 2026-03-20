import { useEffect, useRef, useState, useCallback, useMemo } from "react";

import { uartShared } from "../lib/pm3WebUSB";
import {
  getTransportManager,
  type TransportType,
  type TransportInfo,
  type TransportDevice,
} from "../lib/transports";

interface WasmModule {
  ccall?: (
    ident: string,
    returnType: string | null,
    argTypes: string[],
    args: unknown[],
    opts?: unknown,
  ) => unknown;
  cwrap?: (
    ident: string,
    returnType: string | null,
    argTypes: string[],
    opts?: unknown,
  ) => (...callArgs: unknown[]) => unknown;
  FS?: {
    init: (
      stdin: () => number,
      stdout: (code: number) => void,
      stderr: (code: number) => void,
    ) => void;
  };
  _pm3_uart_rx_head_ptr?: () => number;
  _pm3_uart_rx_tail_ptr?: () => number;
  _pm3_uart_rx_buf_ptr?: () => number;
  _pm3_uart_tx_head_ptr?: () => number;
  _pm3_uart_tx_tail_ptr?: () => number;
  _pm3_uart_tx_buf_ptr?: () => number;
  _pm3_uart_stdin_head_ptr?: () => number;
  _pm3_uart_stdin_tail_ptr?: () => number;
  _pm3_uart_stdin_buf_ptr?: () => number;
  _pm3_uart_rb_capacity?: () => number;
  _pm3_console?: (...args: unknown[]) => number;
  _pm3_grabbed_output_get?: (...args: unknown[]) => number;
  _pm3_get_current_dev?: () => number;
  _pm3_web_exec?: (...args: unknown[]) => number;
  _pm3_web_exec_opts?: (...args: unknown[]) => number;
  _pm3_web_take_output?: () => number;
  preRun?: () => void;
  onRuntimeInitialized?: () => void;
  locateFile?: (path: string, prefix: string) => string;
  print?: (text: string) => void;
  printErr?: (text: string) => void;
  HEAPU8?: Uint8Array;
  HEAPU32?: Uint32Array;
}

declare global {
  interface Window {
    Module: WasmModule;
    proxmark3_main?: () => void;
    __PM3_WASM_LOADED__?: boolean;
    pm3WebUSB?: unknown; // Legacy - kept for backward compatibility
  }
}

interface UseProxmarkWasmOptions {
  onOutput: (text: string) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

interface UseProxmarkWasmReturn {
  isLoading: boolean;
  isReady: boolean;
  isDeviceConnected: boolean;
  error: Error | null;
  sendCommand: (command: string) => void;
  sendInput: (char: string) => void;
  sendBreak: () => void;
  hardReset: () => Promise<void>;
  connectDevice: (transportType?: TransportType, device?: TransportDevice) => Promise<boolean>;
  disconnectDevice: () => Promise<void>;
  // New transport-related returns
  availableTransports: TransportInfo[];
  activeTransportType: TransportType | null;
}

// Global state to track if WASM is already loaded (survives React re-renders)
let wasmLoadAttempted = false;
let wasmLoaded = false;
let globalModule: WasmModule | null = null;

type WasmCommandExportName =
  | "pm3_console"
  | "pm3_get_current_dev"
  | "pm3_grabbed_output_get"
  | "pm3_web_exec"
  | "pm3_web_exec_opts"
  | "pm3_web_take_output";

function hasExport(module: WasmModule | null, exportName: WasmCommandExportName): boolean {
  if (!module) {
    return false;
  }

  return typeof (module as Record<string, unknown>)[`_${exportName}`] === "function";
}

function supportsStructuredCommandApi(module: WasmModule | null): boolean {
  if (!module?.ccall) {
    return false;
  }

  return (
    hasExport(module, "pm3_web_exec_opts") ||
    (hasExport(module, "pm3_console") && hasExport(module, "pm3_get_current_dev"))
  );
}

function pushCommandToStdin(command: string): void {
  for (let i = 0; i < command.length; i++) {
    uartShared.pushStdin(command.charCodeAt(i));
  }
  uartShared.pushStdin("\n".charCodeAt(0));
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : "Unknown error");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get the device path for the WASM client based on transport type
 */
function getDevicePath(transportType: TransportType): string {
  switch (transportType) {
    case "webserial":
      return "/dev/webserial";
    case "tauri-serial":
      return "/dev/tauriserial";
    case "tauri-bluetooth":
      return "/dev/rfcomm0";
    default:
      return "/dev/webserial";
  }
}

export function useProxmarkWasm({
  onOutput,
  onReady,
  onError,
}: UseProxmarkWasmOptions): UseProxmarkWasmReturn {
  const [isLoading, setIsLoading] = useState(!wasmLoaded);
  const [isReady, setIsReady] = useState(wasmLoaded);
  const [isDeviceConnected, setIsDeviceConnected] = useState(false);
  const [activeTransportType, setActiveTransportType] = useState<TransportType | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const outputBufferRef = useRef<string>("");
  const outputFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onOutputRef = useRef(onOutput);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const commandQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const pendingDevicePathRef = useRef<string | null>(null);
  const pendingDeviceConnectRef = useRef<Promise<void> | null>(null);
  const isReadyRef = useRef(wasmLoaded);

  // Get transport manager instance
  const transportManager = useMemo(() => getTransportManager(), []);

  // Get available transports
  const availableTransports = useMemo(() => {
    return transportManager.getAvailableTransports();
  }, [transportManager]);

  // Keep refs updated
  useEffect(() => {
    onOutputRef.current = onOutput;
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
    isReadyRef.current = isReady;
  }, [isReady, onOutput, onReady, onError]);

  // Set up transport event handlers
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
  }, [transportManager]);

  // Flush output buffer
  const flushOutput = useCallback(() => {
    if (outputFlushTimerRef.current) {
      clearTimeout(outputFlushTimerRef.current);
      outputFlushTimerRef.current = null;
    }

    if (outputBufferRef.current) {
      onOutputRef.current(outputBufferRef.current);
      outputBufferRef.current = "";
    }
  }, []);

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

  // Periodic flush timer to ensure output is shown even without newlines
  useEffect(() => {
    const flushInterval = setInterval(() => {
      if (outputBufferRef.current) {
        flushOutput();
      }
    }, 100); // Flush every 100ms

    return () => {
      clearInterval(flushInterval);
      if (outputFlushTimerRef.current) {
        clearTimeout(outputFlushTimerRef.current);
        outputFlushTimerRef.current = null;
      }
    };
  }, [flushOutput]);

  useEffect(() => {
    // Already loaded from previous mount
    if (wasmLoaded && globalModule) {
      setIsReady(true);
      setIsLoading(false);
      return;
    }

    // Already attempting to load
    if (wasmLoadAttempted) {
      return;
    }

    wasmLoadAttempted = true;

    // Setup Module before loading the script
    const module: WasmModule = {
      locateFile: (path: string, prefix: string) => {
        if (path.endsWith(".wasm")) {
          return `${prefix}${path}?t=${Date.now()}`;
        }
        return prefix + path;
      },
      // Module.print/printErr handlers work better with pthreads
      print: (text: string) => {
        outputBufferRef.current += text + "\n";
        scheduleOutputFlush(0);
      },
      printErr: (text: string) => {
        outputBufferRef.current += text + "\n";
        scheduleOutputFlush(0);
      },
      preRun: function () {
        // stdin - returns characters from shared ring buffer (handled by C side now)
        function stdin(): number {
          return -1; // No longer used by JS side directly
        }

        // stdout - collects output and sends to terminal
        function stdout(code: number): void {
          if (code === 0x0a) {
            // newline
            outputBufferRef.current += "\r\n";
          } else if (code === 0x0d) {
            // carriage return - flush for progress updates
            outputBufferRef.current += "\r";
          } else {
            outputBufferRef.current += String.fromCharCode(code);
          }

          // Keep WebSerial responsive by batching UI writes instead of
          // flushing every newline/carriage return from the worker thread.
          if (outputBufferRef.current.length > 4096) {
            flushOutput();
          } else {
            scheduleOutputFlush(code === 0x0d ? 0 : 16);
          }
        }

        // stderr - same as stdout
        function stderr(code: number): void {
          stdout(code);
        }

        // Initialize Emscripten's FS with our handlers
        const emFS = (globalThis as Record<string, unknown>)["FS"] as
          | {
              init?: (
                stdin: () => number,
                stdout: (code: number) => void,
                stderr: (code: number) => void,
              ) => void;
            }
          | undefined;
        if (emFS?.init) {
          emFS.init(stdin, stdout, stderr);
        }
      },
    };

    module.onRuntimeInitialized = () => {
      // Initialize the shared UART buffers as soon as the runtime is ready
      uartShared.init(module);
      console.info(
        supportsStructuredCommandApi(module)
          ? "[PM3] Structured command API detected"
          : "[PM3] Structured command API unavailable; falling back to stdin injection",
      );

      wasmLoaded = true;
      globalModule = module;
      setIsReady(true);
      setIsLoading(false);
      onReadyRef.current?.();
    };

    // Set global Module before loading script
    window.Module = module;
    globalModule = module;

    // Check if script already exists
    const existingScript = document.querySelector('script[src="wasm/proxmark3.js"]');
    if (existingScript) {
      return;
    }

    // Load the WASM JavaScript
    const script = document.createElement("script");
    script.src = `wasm/proxmark3.js?t=${Date.now()}`;
    script.async = true;
    script.onerror = () => {
      const err = new Error("Failed to load WASM module");
      setError(err);
      setIsLoading(false);
      onErrorRef.current?.(err);
    };

    document.body.appendChild(script);
  }, [scheduleOutputFlush, flushOutput]);

  const normalizeAndReportError = useCallback((error: unknown): Error => {
    const normalized = toError(error);
    console.error("PM3 WASM command error:", normalized);
    onErrorRef.current?.(normalized);
    return normalized;
  }, []);

  const executeStructuredCommand = useCallback(
    async (module: WasmModule, command: string): Promise<number> => {
      if (!module.ccall) {
        throw new Error("WASM runtime does not expose ccall");
      }

      if (hasExport(module, "pm3_web_exec_opts")) {
        return (await module.ccall!(
          "pm3_web_exec_opts",
          "number",
          ["string", "number", "number"],
          [command, 0, 0],
          { async: true },
        )) as number;
      }

      if (hasExport(module, "pm3_console") && hasExport(module, "pm3_get_current_dev")) {
        const devPtr = module.ccall!("pm3_get_current_dev", "number", [], []) as number;
        return (await module.ccall!(
          "pm3_console",
          "number",
          ["number", "string", "number", "number"],
          [devPtr, command, 0, 0],
          { async: true },
        )) as number;
      }

      throw new Error("Structured PM3 command API not available");
    },
    [],
  );

  const enqueueCommand = useCallback(
    (command: string): Promise<number | void> => {
      const run = async (): Promise<number | void> => {
        const module = globalModule;
        if (!module || !isReadyRef.current) {
          throw new Error("WASM client is not ready");
        }

        const shouldUseStructuredApi =
          supportsStructuredCommandApi(module) &&
          transportManager.activeTransportType !== "webserial" &&
          pendingDevicePathRef.current !== "/dev/webserial";

        // WebSerial needs the event loop free so the RX/TX pumps can move bytes.
        // The structured PM3 API can block the main thread in-browser, which leaves
        // the client stuck in offline mode during hw connect / live RFID commands.
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
    [executeStructuredCommand, transportManager],
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
  }, [enqueueCommand, normalizeAndReportError]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    void flushPendingDeviceConnect().catch(() => undefined);
  }, [flushPendingDeviceConnect, isReady]);

  // Send a complete command (with newline)
  const sendCommand = useCallback(
    (command: string) => {
      if (!isReadyRef.current) return;
      void enqueueCommand(command).catch((error) => {
        normalizeAndReportError(error);
      });
    },
    [enqueueCommand, normalizeAndReportError],
  );

  // Send a single character (for direct terminal input)
  const sendInput = useCallback(
    (char: string) => {
      if (!isReady) return;
      uartShared.pushStdin(char.charCodeAt(0));
    },
    [isReady],
  );

  // Send break signal (Ctrl+C) to stop current operation
  const sendBreak = useCallback(() => {
    if (!isReady) return;
    // ASCII 3 = ETX (End of Text) = Ctrl+C
    uartShared.pushStdin(3);
  }, [isReady]);

  // Hard reset - forcefully restart WASM by reloading the page
  // This is the nuclear option when sendBreak doesn't work
  const hardReset = useCallback(async (): Promise<void> => {
    console.warn("[PM3] Hard reset requested - disconnecting and reloading...");
    pendingDevicePathRef.current = null;
    pendingDeviceConnectRef.current = null;
    commandQueueRef.current = Promise.resolve();

    // First disconnect the device via transport manager
    try {
      await transportManager.disconnect();
    } catch (e) {
      console.error("Error disconnecting during hard reset:", e);
    }
    setIsDeviceConnected(false);

    // Clear the ring buffers by resetting head/tail pointers
    if (globalModule?.HEAPU32) {
      const heapU32 = globalModule.HEAPU32;
      const rxHeadPtr = globalModule._pm3_uart_rx_head_ptr?.();
      const rxTailPtr = globalModule._pm3_uart_rx_tail_ptr?.();
      const txHeadPtr = globalModule._pm3_uart_tx_head_ptr?.();
      const txTailPtr = globalModule._pm3_uart_tx_tail_ptr?.();
      const stdinHeadPtr = globalModule._pm3_uart_stdin_head_ptr?.();
      const stdinTailPtr = globalModule._pm3_uart_stdin_tail_ptr?.();

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

    // Give it a moment then reload
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Reload the page to fully reset WASM state
    window.location.reload();
  }, [transportManager]);

  // Connect to physical device via selected transport
  const connectDevice = useCallback(
    async (transportType?: TransportType, device?: TransportDevice): Promise<boolean> => {
      // Use specified transport type or default
      const selectedType = transportType || transportManager.getDefaultTransportType();
      if (!selectedType) {
        console.error("No transport available");
        return false;
      }

      const connected = await transportManager.connect(selectedType, device);

      if (connected) {
        pendingDevicePathRef.current = getDevicePath(selectedType);
        // Give freshly opened serial transports a moment to settle before the
        // PM3 client sends the initial hw connect command.
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
    [flushPendingDeviceConnect, transportManager],
  );

  // Disconnect from physical device
  const disconnectDevice = useCallback(async (): Promise<void> => {
    pendingDevicePathRef.current = null;
    await transportManager.disconnect();
  }, [transportManager]);

  return {
    isLoading,
    isReady,
    isDeviceConnected,
    error,
    sendCommand,
    sendInput,
    sendBreak,
    hardReset,
    connectDevice,
    disconnectDevice,
    availableTransports,
    activeTransportType,
  };
}

export default useProxmarkWasm;
