import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity } from "lucide-react";
import { FREQUENCY_PRESETS, clampDivisor } from "../commands";
import { SectionLabel } from "../shared";
import type { LFConfig } from "../types";

interface LFFrequencySectionProps {
  config: LFConfig;
  frequency: number;
  onDivisorChange: (value: number) => void;
  onFrequencyPreset: (value: number) => void;
}

export function LFFrequencySection({
  config,
  frequency,
  onDivisorChange,
  onFrequencyPreset,
}: LFFrequencySectionProps) {
  return (
    <div className="bg-secondary/20 border-b p-3 space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel icon={<Activity className="h-3 w-3" />}>Frequency</SectionLabel>
        <div className="flex gap-1">
          {FREQUENCY_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              size="sm"
              variant={config.divisor === preset.divisor ? "default" : "outline"}
              onClick={() => onFrequencyPreset(preset.divisor)}
              className="h-6 px-2 text-[10px]"
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Divisor</span>
          <span className="font-mono">{config.divisor}</span>
        </div>
        <input
          type="range"
          min={19}
          max={255}
          value={config.divisor}
          onChange={(e) => onDivisorChange(clampDivisor(parseInt(e.target.value, 10)))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>~600 kHz</span>
          <span>~47 kHz</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={19}
          max={255}
          value={config.divisor}
          onChange={(e) => onDivisorChange(clampDivisor(parseInt(e.target.value, 10) || 95))}
          className="h-8 w-20 font-mono text-xs"
        />
        <span className="text-xs text-muted-foreground">= {frequency.toFixed(3)} kHz</span>
      </div>
    </div>
  );
}
