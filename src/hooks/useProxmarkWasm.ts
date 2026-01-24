import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

import { uartShared } from '../lib/pm3WebUSB';
import { getTransportManager, type TransportType, type TransportInfo, type TransportDevice } from '../lib/transports';

interface WasmModule {
  ccall?: (ident: string, returnType: string | null, argTypes: string[], args: any[], opts?: any) => any;
  cwrap?: (ident: string, returnType: string | null, argTypes: string[], opts?: any) => Function;
  FS?: {
    init: (stdin: () => number, stdout: (code: number) => void, stderr: (code: number) => void) => void;
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
    pm3WebUSB?: any; // Legacy - kept for backward compatibility
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

/**
 * Get the device path for the WASM client based on transport type
 */
function getDevicePath(transportType: TransportType): string {
  switch (transportType) {
    case 'webserial':
      return '/dev/webserial';
    case 'tauri-serial':
      return '/dev/tauriserial';
    case 'tauri-bluetooth':
      return '/dev/rfcomm0';
    default:
      return '/dev/webserial';
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
  const outputBufferRef = useRef<string>('');
  const onOutputRef = useRef(onOutput);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);

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
  }, [onOutput, onReady, onError]);

  // Set up transport event handlers
  useEffect(() => {
    transportManager.setEventHandlers({
      onConnect: () => {
        setIsDeviceConnected(true);
        setActiveTransportType(transportManager.activeTransportType);
      },
      onDisconnect: () => {
        setIsDeviceConnected(false);
        setActiveTransportType(null);
      },
      onError: (err) => {
        console.error('Transport error:', err);
        onErrorRef.current?.(err);
      },
    });
  }, [transportManager]);

  // Flush output buffer
  const flushOutput = useCallback(() => {
    if (outputBufferRef.current) {
      onOutputRef.current(outputBufferRef.current);
      outputBufferRef.current = '';
    }
  }, []);

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
        if (path.endsWith('.wasm')) {
          return `${prefix}${path}?t=${Date.now()}`;
        }
        return prefix + path;
      },
      preRun: function () {
        // stdin - returns characters from shared ring buffer (handled by C side now)
        function stdin(): number {
          return -1; // No longer used by JS side directly
        }

        // stdout - collects output and sends to terminal
        function stdout(code: number): void {
          if (code === 0x0A) { // newline
            outputBufferRef.current += '\r\n';
          } else {
            outputBufferRef.current += String.fromCharCode(code);
          }
          // Flush on newline or when buffer gets large
          if (code === 0x0A || outputBufferRef.current.length > 100) {
            flushOutput();
          }
        }

        // stderr - same as stdout
        function stderr(code: number): void {
          stdout(code);
        }

        // Initialize Emscripten's FS with our handlers
        // @ts-expect-error FS is added by Emscripten
        if (typeof FS !== 'undefined') {
          // @ts-expect-error FS is added by Emscripten
          FS.init(stdin, stdout, stderr);
        }
      },
    };

    module.onRuntimeInitialized = () => {
      // Initialize the shared UART buffers as soon as the runtime is ready
      uartShared.init(module);

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
    const script = document.createElement('script');
    script.src = `wasm/proxmark3.js?t=${Date.now()}`;
    script.async = true;
    script.onerror = () => {
      const err = new Error('Failed to load WASM module');
      setError(err);
      setIsLoading(false);
      onErrorRef.current?.(err);
    };

    document.body.appendChild(script);
  }, [flushOutput]);

  // Send a complete command (with newline)
  const sendCommand = useCallback((command: string) => {
    if (!isReady) return;

    // Add each character to shared stdin
    for (let i = 0; i < command.length; i++) {
      uartShared.pushStdin(command.charCodeAt(i));
    }
    // Add newline
    uartShared.pushStdin('\n'.charCodeAt(0));
  }, [isReady]);

  // Send a single character (for direct terminal input)
  const sendInput = useCallback((char: string) => {
    if (!isReady) return;
    uartShared.pushStdin(char.charCodeAt(0));
  }, [isReady]);

  // Send break signal (Ctrl+C) to stop current operation
  const sendBreak = useCallback(() => {
    if (!isReady) return;
    // ASCII 3 = ETX (End of Text) = Ctrl+C
    uartShared.pushStdin(3);
  }, [isReady]);

  // Connect to physical device via selected transport
  const connectDevice = useCallback(async (
    transportType?: TransportType,
    device?: TransportDevice
  ): Promise<boolean> => {
    // Use specified transport type or default
    const selectedType = transportType || transportManager.getDefaultTransportType();
    if (!selectedType) {
      console.error('No transport available');
      return false;
    }

    const connected = await transportManager.connect(selectedType, device);

    if (connected && isReady) {
      // Tell the WASM client to connect with the appropriate device path
      const devicePath = getDevicePath(selectedType);
      sendCommand(`hw connect -p ${devicePath}`);
    }

    return connected;
  }, [isReady, sendCommand, transportManager]);

  // Disconnect from physical device
  const disconnectDevice = useCallback(async (): Promise<void> => {
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
    connectDevice,
    disconnectDevice,
    availableTransports,
    activeTransportType,
  };
}

export default useProxmarkWasm;
