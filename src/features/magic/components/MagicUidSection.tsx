import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Shuffle, Copy, Zap } from "lucide-react";
import { SAK_PRESETS } from "../constants";
import type { MagicCardType, ValidationResult } from "../types";
import { cn } from "@/lib/utils";

interface MagicUidSectionProps {
  disabled?: boolean;
  cardType: MagicCardType;
  uid: string;
  uidValidation: ValidationResult;
  onUidChange: (value: string) => void;
  onRandomUid: () => void;
  onCopyUid: (value: string) => void;
  atqa: string;
  onAtqaChange: (value: string) => void;
  sak: string;
  onSakChange: (value: string) => void;
  gen4Password: string;
  onGen4PasswordChange: (value: string) => void;
  onWriteUid: () => void;
}

export function MagicUidSection({
  disabled = false,
  cardType,
  uid,
  uidValidation,
  onUidChange,
  onRandomUid,
  onCopyUid,
  atqa,
  onAtqaChange,
  sak,
  onSakChange,
  gen4Password,
  onGen4PasswordChange,
  onWriteUid,
}: MagicUidSectionProps) {
  const uidHasValue = uid.length > 0;

  const uidInputClass = useMemo(
    () =>
      cn(
        "font-mono text-xs",
        uidValidation.valid ? "border-green-500/50" : uidHasValue ? "border-red-500/50" : "",
      ),
    [uidHasValue, uidValidation.valid],
  );

  return (
    <div className="space-y-3 p-3">
      <label className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <Key className="h-3 w-3" />
        Set UID
      </label>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[10px] text-muted-foreground">UID (4/7/10 bytes)</label>
          <div className="flex gap-2">
            <Input
              value={uid}
              onChange={(e) => onUidChange(e.target.value)}
              placeholder="12345678"
              className={uidInputClass}
              maxLength={20}
            />
            <Button
              size="icon"
              variant="outline"
              onClick={onRandomUid}
              title="Generate random UID"
              className="shrink-0"
            >
              <Shuffle className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onCopyUid(uid)} className="shrink-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          {!uidValidation.valid && uidHasValue ? (
            <p className="text-[10px] text-red-400">{uidValidation.error}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <label className="text-[10px] text-muted-foreground">ATQA</label>
            <Input
              value={atqa}
              onChange={(e) =>
                onAtqaChange(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-F0-9]/gi, "")
                    .slice(0, 4),
                )
              }
              placeholder="0004"
              className="font-mono text-xs"
              maxLength={4}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-muted-foreground">SAK</label>
            <Input
              value={sak}
              onChange={(e) =>
                onSakChange(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-F0-9]/gi, "")
                    .slice(0, 2),
                )
              }
              placeholder="08"
              className="font-mono text-xs"
              maxLength={2}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {SAK_PRESETS.slice(0, 4).map((preset) => (
          <Button
            key={preset.value}
            size="sm"
            variant="ghost"
            onClick={() => onSakChange(preset.value)}
            className="h-5 px-1.5 text-[9px]"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {cardType === "gen4" ? (
        <div className="space-y-2">
          <label className="text-[10px] text-muted-foreground">Gen4 Password (4 bytes)</label>
          <Input
            value={gen4Password}
            onChange={(e) =>
              onGen4PasswordChange(
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-F0-9]/gi, "")
                  .slice(0, 8),
              )
            }
            placeholder="00000000"
            className="w-32 font-mono text-xs"
            maxLength={8}
          />
        </div>
      ) : null}

      <Button
        onClick={onWriteUid}
        disabled={disabled || !uidValidation.valid}
        className="w-full gap-2"
      >
        <Zap className="h-4 w-4" />
        Write UID
      </Button>
    </div>
  );
}
