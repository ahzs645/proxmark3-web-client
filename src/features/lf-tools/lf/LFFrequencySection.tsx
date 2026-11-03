import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity } from "lucide-react";
import { FREQUENCY_PRESETS, clampDivisor } from "../commands";
import { PanelSection } from "@/components/panels/shared/PanelSection";
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
    <PanelSection
      title="Frequency"
      icon={<Activity className="h-3 w-3" />}
      actions={FREQUENCY_PRESETS.map((preset) => (
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
    >
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
    </PanelSection>
  );
}
