import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACCESS_PRESETS, type AccessBitsResult, type AccessPresetKey } from "@/lib/accessBits";
import { cn } from "@/lib/utils";
import { Check, Copy, Wand2, X } from "lucide-react";

interface TrailerBitsSectionProps {
  accessBitsHex: string;
  decoded: AccessBitsResult;
  cValues: [number, number, number, number];
  onAccessBitsChange: (value: string) => void;
  onCValueChange: (index: number, value: number) => void;
  onPresetClick: (presetKey: AccessPresetKey) => void;
  onCopy: (text: string) => void;
}

export function TrailerBitsSection({
  accessBitsHex,
  decoded,
  cValues,
  onAccessBitsChange,
  onCValueChange,
  onPresetClick,
  onCopy,
}: TrailerBitsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Access Bits (3 bytes hex)</label>
          <div className="flex gap-2">
            <Input
              value={accessBitsHex}
              onChange={(e) => onAccessBitsChange(e.target.value)}
              placeholder="FF0780"
              className={cn(
                "font-mono text-sm",
                decoded.valid ? "border-green-500/50" : "border-red-500/50",
              )}
              maxLength={6}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onCopy(accessBitsHex)}
              className="shrink-0"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          {decoded.valid ? (
            <div className="flex items-center gap-1 text-xs text-green-500">
              <Check className="h-3 w-3" />
              Valid access bits
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-red-500">
              <X className="h-3 w-3" />
              {decoded.error}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Manual C Values (0-7)</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "C0", value: cValues[0], index: 0 },
              { label: "C1", value: cValues[1], index: 1 },
              { label: "C2", value: cValues[2], index: 2 },
              { label: "C3", value: cValues[3], index: 3 },
            ].map(({ label, value, index }) => (
              <div key={label} className="space-y-1">
                <label className="text-[10px] text-muted-foreground">
                  {label} {index < 3 ? `(Blk ${index})` : "(Trailer)"}
                </label>
                <Input
                  type="number"
                  min={0}
                  max={7}
                  value={value}
                  onChange={(e) => onCValueChange(index, Number.parseInt(e.target.value, 10) || 0)}
                  className="h-8 text-center font-mono text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <Wand2 className="h-3 w-3" />
          Presets
        </label>
        <div className="flex flex-wrap gap-2">
          {(
            Object.entries(ACCESS_PRESETS) as [
              AccessPresetKey,
              (typeof ACCESS_PRESETS)[AccessPresetKey],
            ][]
          ).map(([key, preset]) => (
            <Button
              key={key}
              size="sm"
              variant={accessBitsHex === preset.hex ? "default" : "outline"}
              onClick={() => onPresetClick(key)}
              className="h-7 text-xs"
              title={preset.description}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
