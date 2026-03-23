import type { WasmModule } from "./types";

let wasmLoadAttempted = false;
let wasmLoaded = false;
let globalModule: WasmModule | null = null;

export function getWasmLoadAttempted() {
  return wasmLoadAttempted;
}

export function setWasmLoadAttempted(value: boolean) {
  wasmLoadAttempted = value;
}

export function getWasmLoaded() {
  return wasmLoaded;
}

export function setWasmLoaded(value: boolean) {
  wasmLoaded = value;
}

export function getGlobalModule() {
  return globalModule;
}

export function setGlobalModule(module: WasmModule | null) {
  globalModule = module;
}
