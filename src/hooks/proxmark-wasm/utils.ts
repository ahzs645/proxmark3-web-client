import { uartShared } from "../../lib/pm3WebUSB";
import type { TransportType } from "../../lib/transports";
import type { WasmCommandExportName, WasmModule } from "./types";

export function hasExport(module: WasmModule | null, exportName: WasmCommandExportName): boolean {
  if (!module) {
    return false;
  }

  return typeof (module as Record<string, unknown>)[`_${exportName}`] === "function";
}

export function supportsStructuredCommandApi(module: WasmModule | null): boolean {
  if (!module?.ccall) {
    return false;
  }

  return (
    hasExport(module, "pm3_web_exec_opts") ||
    (hasExport(module, "pm3_console") && hasExport(module, "pm3_get_current_dev"))
  );
}

export function pushCommandToStdin(command: string): void {
  for (let i = 0; i < command.length; i++) {
    uartShared.pushStdin(command.charCodeAt(i));
  }
  uartShared.pushStdin("\n".charCodeAt(0));
}

export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : "Unknown error");
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getDevicePath(transportType: TransportType): string {
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
