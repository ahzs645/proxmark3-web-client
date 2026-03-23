import type { WasmModule } from "../../hooks/proxmark-wasm/types";

export interface Pm3BrowserModule extends WasmModule {
  wasmMemory?: WebAssembly.Memory;
  asm?: Record<string, (...args: unknown[]) => unknown>;
  [key: string]: unknown;
}
