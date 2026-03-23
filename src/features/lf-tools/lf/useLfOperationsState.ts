import { useMemo, useState } from "react";
import { DEFAULT_LF_CONFIG, divisorToFreq } from "../commands";
import type { LFConfig } from "../types";

export function useLfOperationsState() {
  const [config, setConfig] = useState<LFConfig>(DEFAULT_LF_CONFIG);
  const [samples, setSamples] = useState("40000");

  const frequency = useMemo(() => divisorToFreq(config.divisor), [config.divisor]);

  const setConfigValue = <K extends keyof LFConfig>(key: K, value: LFConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const setDivisor = (divisor: number) => {
    setConfig((prev) => ({ ...prev, divisor }));
  };

  const resetConfig = () => {
    setConfig(DEFAULT_LF_CONFIG);
  };

  return {
    config,
    frequency,
    samples,
    setSamples,
    setConfigValue,
    setDivisor,
    resetConfig,
  };
}
