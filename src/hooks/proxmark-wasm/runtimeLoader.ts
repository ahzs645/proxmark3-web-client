import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { uartShared } from "../../lib/pm3WebUSB";
import {
  getGlobalModule,
  getWasmLoadAttempted,
  getWasmLoaded,
  setGlobalModule,
  setWasmLoadAttempted,
  setWasmLoaded,
} from "./runtimeState";
import type { WasmModule } from "./types";
import { supportsStructuredCommandApi } from "./utils";

interface RuntimeLoaderParams {
  flushOutput: () => void;
  onErrorRef: MutableRefObject<((error: Error) => void) | undefined>;
  onReadyRef: MutableRefObject<(() => void) | undefined>;
  outputBufferRef: MutableRefObject<string>;
  scheduleOutputFlush: (delayMs?: number) => void;
  setError: Dispatch<SetStateAction<Error | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setIsReady: Dispatch<SetStateAction<boolean>>;
}

export function ensureWasmRuntimeLoaded({
  flushOutput,
  onErrorRef,
  onReadyRef,
  outputBufferRef,
  scheduleOutputFlush,
  setError,
  setIsLoading,
  setIsReady,
}: RuntimeLoaderParams) {
  if (getWasmLoaded() && getGlobalModule()) {
    setIsReady(true);
    setIsLoading(false);
    return;
  }

  if (getWasmLoadAttempted()) {
    return;
  }

  setWasmLoadAttempted(true);

  const module: WasmModule = {
    locateFile: (path: string, prefix: string) => {
      if (path.endsWith(".wasm")) {
        return `${prefix}${path}?t=${Date.now()}`;
      }
      return prefix + path;
    },
    print: (text: string) => {
      outputBufferRef.current += text + "\n";
      scheduleOutputFlush(0);
    },
    printErr: (text: string) => {
      outputBufferRef.current += text + "\n";
      scheduleOutputFlush(0);
    },
    preRun: function () {
      function stdin(): number {
        return -1;
      }

      function stdout(code: number): void {
        if (code === 0x0a) {
          outputBufferRef.current += "\r\n";
        } else if (code === 0x0d) {
          outputBufferRef.current += "\r";
        } else {
          outputBufferRef.current += String.fromCharCode(code);
        }

        if (outputBufferRef.current.length > 4096) {
          flushOutput();
        } else {
          scheduleOutputFlush(code === 0x0d ? 0 : 16);
        }
      }

      function stderr(code: number): void {
        stdout(code);
      }

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
    uartShared.init(module);
    console.info(
      supportsStructuredCommandApi(module)
        ? "[PM3] Structured command API detected"
        : "[PM3] Structured command API unavailable; falling back to stdin injection",
    );

    setWasmLoaded(true);
    setGlobalModule(module);
    setIsReady(true);
    setIsLoading(false);
    onReadyRef.current?.();
  };

  window.Module = module;
  setGlobalModule(module);

  const existingScript = document.querySelector('script[src="wasm/proxmark3.js"]');
  if (existingScript) {
    return;
  }

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
}
