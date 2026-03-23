import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Download, Upload } from "lucide-react";
import { CHIP_TYPES, CLOCK_RATES } from "../commands";
import { copyText } from "../clipboard";
import type { ChipType } from "../types";
import { SectionLabel } from "../shared";
import { cn } from "@/lib/utils";

interface T55xxEm410xSectionProps {
  emId: string;
  chipType: ChipType;
  clockRate: number;
  isEmIdValid: boolean;
  onEmIdChange: (value: string) => void;
  onChipTypeChange: (value: ChipType) => void;
  onClockRateChange: (value: number) => void;
  onRead: () => void;
  onClone: () => void;
  disabled?: boolean;
}

export function T55xxEm410xSection({
  emId,
  chipType,
  clockRate,
  isEmIdValid,
  onEmIdChange,
  onChipTypeChange,
  onClockRateChange,
  onRead,
  onClone,
  disabled = false,
}: T55xxEm410xSectionProps) {
  return (
    <div className="p-3 space-y-3">
      <SectionLabel icon={<Upload className="h-3 w-3" />}>EM410x Clone</SectionLabel>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onRead} disabled={disabled} className="gap-1">
          <Download className="h-3 w-3" />
          Read
        </Button>
        <Input
          value={emId}
          onChange={(e) => onEmIdChange(e.target.value)}
          placeholder="EM410x ID (10 hex)"
          className={cn(
            "font-mono text-xs flex-1",
            isEmIdValid ? "border-green-500/50" : emId.length > 0 ? "border-red-500/50" : "",
          )}
          maxLength={10}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => copyText(emId)}
          disabled={!emId}
          className="shrink-0"
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Target:</span>
          <div className="flex overflow-hidden rounded-md border">
            {(Object.entries(CHIP_TYPES) as [ChipType, (typeof CHIP_TYPES)[ChipType]][]).map(
              ([key, cfg]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={chipType === key ? "default" : "ghost"}
                  onClick={() => onChipTypeChange(key)}
                  className="h-7 rounded-none px-3 text-xs"
                >
                  {cfg.label}
                </Button>
              ),
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Clock:</span>
          <select
            value={clockRate}
            onChange={(e) => onClockRateChange(parseInt(e.target.value, 10))}
            className="h-7 rounded border bg-background px-2 text-xs"
          >
            {CLOCK_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button onClick={onClone} disabled={disabled || !isEmIdValid} className="w-full gap-2">
        <Upload className="h-4 w-4" />
        Clone to {CHIP_TYPES[chipType].label}
      </Button>
    </div>
  );
}
