import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, Download, RefreshCw, Settings, Sliders } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/panels/shared/SectionLabel";
import { useAppSettings } from "@/features/settings/useAppSettings";
import type { LFConfig } from "../types";
import { buildLfConfigCommand } from "../commands";

interface LFAdvancedSectionProps {
  config: LFConfig;
  onConfigChange: <K extends keyof LFConfig>(key: K, value: LFConfig[K]) => void;
  onGetConfig: () => void;
  onSetConfig: () => void;
  onResetConfig: () => void;
  disabled?: boolean;
}

export function LFAdvancedSection({
  config,
  onConfigChange,
  onGetConfig,
  onSetConfig,
  onResetConfig,
  disabled = false,
}: LFAdvancedSectionProps) {
  const { showAdvancedOptions } = useAppSettings();
  const [showAdvanced, setShowAdvanced] = useState(showAdvancedOptions);

  return (
    // Same box as a PanelSection, with the title row doubling as the toggle.
    <section className="overflow-hidden rounded-xl border bg-card/40">
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-secondary/30"
      >
        <SectionLabel icon={<Sliders className="h-3 w-3 text-amber-500" />}>
          Advanced Configuration
        </SectionLabel>
        <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")} />
      </button>

      {showAdvanced && (
        <div className="space-y-3 border-t bg-secondary/20 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Bits per Sample</label>
              <Input
                type="number"
                min={1}
                max={8}
                value={config.bitsPerSample}
                onChange={(e) => onConfigChange("bitsPerSample", parseInt(e.target.value, 10) || 8)}
                className="h-8 font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Decimation</label>
              <Input
                type="number"
                min={1}
                max={8}
                value={config.decimation}
                onChange={(e) => onConfigChange("decimation", parseInt(e.target.value, 10) || 1)}
                className="h-8 font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Trigger Threshold</label>
              <Input
                type="number"
                min={0}
                max={128}
                value={config.triggerThreshold}
                onChange={(e) =>
                  onConfigChange("triggerThreshold", parseInt(e.target.value, 10) || 0)
                }
                className="h-8 font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Samples to Skip</label>
              <Input
                type="number"
                min={0}
                max={65535}
                value={config.samplesToSkip}
                onChange={(e) => onConfigChange("samplesToSkip", parseInt(e.target.value, 10) || 0)}
                className="h-8 font-mono text-xs"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={config.averaging}
              onChange={(e) => onConfigChange("averaging", e.target.checked)}
              className="rounded border-input"
            />
            <span>Enable Averaging</span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onGetConfig}
              disabled={disabled}
              className="flex-1 gap-1 sm:flex-none"
            >
              <Download className="h-3 w-3" />
              Get Config
            </Button>
            <Button
              size="sm"
              onClick={onSetConfig}
              disabled={disabled}
              className="flex-1 gap-1 sm:flex-none"
            >
              <Settings className="h-3 w-3" />
              Apply
            </Button>
            <Button size="sm" variant="ghost" onClick={onResetConfig} className="gap-1">
              <RefreshCw className="h-3 w-3" />
              Reset
            </Button>
          </div>

          <div className="rounded border bg-background p-2">
            <code className="break-all font-mono text-[10px] text-muted-foreground">
              {buildLfConfigCommand(config)}
            </code>
          </div>
        </div>
      )}
    </section>
  );
}
