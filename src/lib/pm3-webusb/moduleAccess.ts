import type { Pm3BrowserModule } from "./types";

type ModuleExport = (...args: unknown[]) => unknown;

export function getPm3Module(): Pm3BrowserModule | null {
  if (typeof window === "undefined") return null;
  return (window.Module as Pm3BrowserModule | undefined) ?? null;
}

export function getModuleExport<T extends ModuleExport>(
  module: Pm3BrowserModule,
  name: string,
): T | undefined {
  const dynamicModule = module as Record<string, unknown>;
  const direct = dynamicModule[name];
  if (typeof direct === "function") return direct as T;

  const asmExport = module.asm?.[name];
  if (typeof asmExport === "function") return asmExport as T;

  const underscored = dynamicModule[`_${name}`];
  if (typeof underscored === "function") return underscored as T;

  return undefined;
}

export function canInitSharedUart(module: Pm3BrowserModule | null): module is Pm3BrowserModule {
  return Boolean(module?.HEAPU8 && getModuleExport(module, "pm3_uart_rx_head_ptr"));
}

export function hasPendingTx(module: Pm3BrowserModule | null): boolean | null {
  if (!module?.HEAPU32) return null;

  const headPtr =
    module._pm3_uart_tx_head_ptr ?? getModuleExport<() => number>(module, "pm3_uart_tx_head_ptr");
  const tailPtr =
    module._pm3_uart_tx_tail_ptr ?? getModuleExport<() => number>(module, "pm3_uart_tx_tail_ptr");

  if (!headPtr || !tailPtr) return null;

  const txHead = Atomics.load(module.HEAPU32, headPtr() >> 2);
  const txTail = Atomics.load(module.HEAPU32, tailPtr() >> 2);

  return txHead !== txTail;
}
