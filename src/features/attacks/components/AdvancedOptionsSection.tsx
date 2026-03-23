import { ChevronDown } from "lucide-react";
import type { AttackType } from "../types";
import { cn } from "@/lib/utils";

interface AdvancedOptionsSectionProps {
  activeAttack: AttackType;
  slowMode: boolean;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onSlowModeChange: (value: boolean) => void;
  buildCommand: () => string;
}

export function AdvancedOptionsSection({
  activeAttack,
  slowMode,
  showAdvanced,
  onToggleAdvanced,
  onSlowModeChange,
  buildCommand,
}: AdvancedOptionsSectionProps) {
  return (
    <>
      <button
        onClick={onToggleAdvanced}
        className="flex w-full items-center justify-between text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>Advanced Options</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")} />
      </button>

      {showAdvanced ? (
        <div className="space-y-2 rounded bg-secondary/20 p-2">
          {activeAttack === "hardnested" ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={slowMode}
                onChange={(e) => onSlowModeChange(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>Slow mode (more reliable, slower)</span>
            </label>
          ) : null}
          <div className="text-[10px] text-muted-foreground">
            Command preview:
            <code className="mt-1 block break-all rounded bg-background p-2 font-mono text-foreground">
              {buildCommand()}
            </code>
          </div>
        </div>
      ) : null}
    </>
  );
}
