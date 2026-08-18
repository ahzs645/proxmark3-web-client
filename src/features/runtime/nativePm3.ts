import { invoke, isTauri } from "@/lib/tauri";

export interface NativePm3Probe {
  available: boolean;
  path: string | null;
  version: string | null;
  error: string | null;
}

export interface NativePm3Result {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface NativePm3Options {
  binaryPath?: string;
  port: string;
}

export function nativePm3Supported(): boolean {
  return isTauri();
}

function optionalPath(binaryPath?: string): string | null {
  const value = binaryPath?.trim();
  return value ? value : null;
}

export async function probeNativePm3(binaryPath?: string): Promise<NativePm3Probe> {
  if (!nativePm3Supported()) {
    return {
      available: false,
      path: null,
      version: null,
      error: "The installed-client runtime is available only in the desktop app.",
    };
  }
  return invoke<NativePm3Probe>("native_pm3_probe", { binaryPath: optionalPath(binaryPath) });
}

export async function runNativePm3(
  options: NativePm3Options,
  command: string,
): Promise<NativePm3Result> {
  if (!nativePm3Supported()) {
    throw new Error("The installed-client runtime is available only in the desktop app.");
  }
  return invoke<NativePm3Result>("native_pm3_run", {
    binaryPath: optionalPath(options.binaryPath),
    port: options.port.trim(),
    command: command.trim(),
  });
}

export function combineNativePm3Output(result: NativePm3Result): string {
  return [result.stdout.trimEnd(), result.stderr.trimEnd()].filter(Boolean).join("\n");
}
