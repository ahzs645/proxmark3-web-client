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

/**
 * What happened to a dispatched command:
 *
 * - `completed` — it ran to completion and we know it (the structured
 *   `pm3_web_exec_opts` / `pm3_console` entry points resolve when the command
 *   returns).
 * - `queued` — it was written into the client's stdin, which is what the
 *   WebSerial path has to do. The client gives no completion callback there and
 *   this build prints its prompt only once at startup, so completion cannot be
 *   observed directly; callers must fall back to a heuristic.
 * - `failed` — the client rejected or threw.
 */
export type CommandDispatchResult = "completed" | "queued" | "failed";

export interface UseProxmarkWasmOptions {
  onOutput: (text: string) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export interface UseProxmarkWasmReturn {
  isLoading: boolean;
  isReady: boolean;
  /** The transport (serial/bluetooth) is open. */
  isDeviceConnected: boolean;
  /**
   * The pm3 client has run `hw connect` against the open transport. Until this
   * is true the port is open but the client itself is still offline, which is
   * why the two are reported separately.
   */
  isClientAttached: boolean;
  /** `hw connect` is in flight. */
  isAttaching: boolean;
  error: Error | null;
  /** Resolves once the command's fate is known — see {@link CommandDispatchResult}. */
  sendCommand: (command: string) => Promise<CommandDispatchResult>;
  sendInput: (char: string) => void;
  sendBreak: () => void;
  /** Drain buffered pm3 output into `onOutput` right now. */
  flushOutput: () => void;
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
