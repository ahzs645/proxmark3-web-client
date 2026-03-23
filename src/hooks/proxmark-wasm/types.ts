import type { TransportDevice, TransportInfo, TransportType } from "../../lib/transports";

export interface WasmModule {
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
    pm3WebUSB?: unknown;
  }
}

export interface UseProxmarkWasmOptions {
  onOutput: (text: string) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export interface UseProxmarkWasmReturn {
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
  availableTransports: TransportInfo[];
  activeTransportType: TransportType | null;
}

export type WasmCommandExportName =
  | "pm3_console"
  | "pm3_get_current_dev"
  | "pm3_grabbed_output_get"
  | "pm3_web_exec"
  | "pm3_web_exec_opts"
  | "pm3_web_take_output";
