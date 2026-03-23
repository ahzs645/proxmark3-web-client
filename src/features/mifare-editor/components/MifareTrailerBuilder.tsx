import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronDown, Copy, Download, Upload, Wand2 } from "lucide-react";
import type { KeyType, TrailerPreset } from "../types";

interface MifareTrailerBuilderProps {
  open: boolean;
  disabled?: boolean;
  keyType: KeyType;
  authKey: string;
  trailerBlock: string;
  trailerKeyA: string;
  trailerKeyB: string;
  trailerAccess: string;
  trailerGpb: string;
  trailerPreview: string;
  presets: TrailerPreset[];
  onOpenChange: (open: boolean) => void;
  onTrailerBlockChange: (value: string) => void;
  onTrailerKeyAChange: (value: string) => void;
  onTrailerKeyBChange: (value: string) => void;
  onTrailerAccessChange: (value: string) => void;
  onTrailerGpbChange: (value: string) => void;
  onApplyPreset: (preset: TrailerPreset) => void;
  onCopy: (text: string) => void;
  onWriteTrailer: () => void;
  onReadTrailer: () => void;
}

export function MifareTrailerBuilder({
  open,
  disabled,
  trailerBlock,
  trailerKeyA,
  trailerKeyB,
  trailerAccess,
  trailerGpb,
  trailerPreview,
  presets,
  onOpenChange,
  onTrailerBlockChange,
  onTrailerKeyAChange,
  onTrailerKeyBChange,
  onTrailerAccessChange,
  onTrailerGpbChange,
  onApplyPreset,
  onCopy,
  onWriteTrailer,
  onReadTrailer,
}: MifareTrailerBuilderProps) {
  return (
    <div className="border-t">
      <button
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-secondary/30"
      >
        <div className="flex items-center gap-2">
          <Wand2 className="h-3 w-3 text-amber-500" />
          <span className="font-medium">Sector Trailer Builder</span>
        </div>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="space-y-3 bg-secondary/20 p-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Target Block</label>
              <Input
                value={trailerBlock}
                onChange={(e) => onTrailerBlockChange(e.target.value)}
                className="h-8 font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Key A</label>
              <Input
                value={trailerKeyA}
                onChange={(e) => onTrailerKeyAChange(e.target.value)}
                className="h-8 font-mono text-xs"
                maxLength={12}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Key B</label>
              <Input
                value={trailerKeyB}
                onChange={(e) => onTrailerKeyBChange(e.target.value)}
                className="h-8 font-mono text-xs"
                maxLength={12}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Access + GPB</label>
              <div className="flex gap-1">
                <Input
                  value={trailerAccess}
                  onChange={(e) => onTrailerAccessChange(e.target.value)}
                  className="h-8 flex-1 font-mono text-xs"
                  maxLength={6}
                  placeholder="FF0780"
                />
                <Input
                  value={trailerGpb}
                  onChange={(e) => onTrailerGpbChange(e.target.value)}
                  className="h-8 w-12 font-mono text-xs"
                  maxLength={2}
                  placeholder="69"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded border bg-background p-2">
            <Badge variant="outline" className="text-[10px]">
              Preview
            </Badge>
            <code className="flex-1 font-mono text-[11px] text-amber-400">
              {trailerPreview.match(/.{1,2}/g)?.join(" ")}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCopy(trailerPreview)}
              className="h-6 w-6 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                size="sm"
                variant="ghost"
                onClick={() => onApplyPreset(preset)}
                className="h-6 text-[10px]"
              >
                <Wand2 className="mr-1 h-2.5 w-2.5" />
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={onWriteTrailer}
              disabled={disabled || trailerPreview.length !== 32}
              className="h-8 text-xs"
            >
              <Upload className="mr-1 h-3 w-3" />
              Write Trailer
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onReadTrailer}
              disabled={disabled}
              className="h-8 text-xs"
            >
              <Download className="mr-1 h-3 w-3" />
              Read Current
            </Button>
          </div>

          <div className="flex items-start gap-2 rounded bg-amber-500/10 p-2 text-[10px] text-amber-400">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              Writing incorrect access bits can permanently lock the sector. Double-check before
              writing.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
