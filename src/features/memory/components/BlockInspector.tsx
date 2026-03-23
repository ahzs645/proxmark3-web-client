import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Block, TrailerInfo } from "@/features/memory/types";
import {
  AlertTriangle,
  Copy,
  CreditCard,
  Download,
  Edit3,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import {
  buildTrailerPreview,
  hexToAscii,
  sanitizeHexInput,
  TRAILER_PRESETS,
} from "@/features/memory/lib/trailer";

interface BlockInspectorProps {
  selectedBlockData: Block | null;
  trailerInfo: TrailerInfo | null;
  showKeys: boolean;
  authKey: string;
  authKeyType: "A" | "B";
  disabled: boolean;
  onAuthKeyChange: (value: string) => void;
  onAuthKeyTypeChange: (value: "A" | "B") => void;
  onReadBlock: (blockIndex: number) => void;
  onWriteBlock: (blockIndex: number, data: string) => void;
  onDataChange: (blockIndex: number, value: string) => void;
  onCopyData: (data: string) => void;
  onZeroBlock: (blockIndex: number) => void;
}

export function BlockInspector({
  selectedBlockData,
  trailerInfo,
  showKeys,
  authKey,
  authKeyType,
  disabled,
  onAuthKeyChange,
  onAuthKeyTypeChange,
  onReadBlock,
  onWriteBlock,
  onDataChange,
  onCopyData,
  onZeroBlock,
}: BlockInspectorProps) {
  const [trailerKeyA, setTrailerKeyA] = useState("FFFFFFFFFFFF");
  const [trailerKeyB, setTrailerKeyB] = useState("FFFFFFFFFFFF");
  const [trailerAccess, setTrailerAccess] = useState("FF0780");
  const [trailerGpb, setTrailerGpb] = useState("69");

  const trailerPreview = useMemo(
    () =>
      buildTrailerPreview({
        keyA: trailerKeyA,
        keyB: trailerKeyB,
        access: trailerAccess,
        gpb: trailerGpb,
      }),
    [trailerAccess, trailerGpb, trailerKeyA, trailerKeyB],
  );

  if (!selectedBlockData) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
        <CreditCard className="mb-2 h-8 w-8 opacity-50" />
        <p>Select a block to inspect</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Block</span>
          <span className="font-mono">{selectedBlockData.index}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Sector</span>
          <span className="font-mono">{selectedBlockData.sector}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Type</span>
          <Badge variant="outline" className="text-[10px]">
            {selectedBlockData.label}
          </Badge>
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Hex Data</span>
        <div className="break-all rounded border bg-secondary/50 p-2 font-mono text-[11px]">
          {selectedBlockData.data
            .replace(/\s/g, "")
            .match(/.{1,2}/g)
            ?.join(" ")}
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">ASCII</span>
        <div className="rounded border bg-secondary/50 p-2 font-mono text-[11px]">
          {hexToAscii(selectedBlockData.data)}
        </div>
      </div>

      {trailerInfo ? (
        <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
            <Wand2 className="h-3 w-3" />
            Sector Trailer Builder
          </div>

          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Key A</span>
              <span className="font-mono text-amber-400">
                {showKeys ? trailerInfo.keyA : "????????????"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Key B</span>
              <span className="font-mono text-amber-400">
                {showKeys ? trailerInfo.keyB : "????????????"}
              </span>
            </div>
          </div>

          <div className="space-y-2 border-t border-amber-500/20 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">New Key A</label>
                <Input
                  value={trailerKeyA}
                  onChange={(e) => setTrailerKeyA(sanitizeHexInput(e.target.value, 12))}
                  className="h-7 text-xs font-mono"
                  maxLength={12}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">New Key B</label>
                <Input
                  value={trailerKeyB}
                  onChange={(e) => setTrailerKeyB(sanitizeHexInput(e.target.value, 12))}
                  className="h-7 text-xs font-mono"
                  maxLength={12}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Access Bits</label>
                <Input
                  value={trailerAccess}
                  onChange={(e) => setTrailerAccess(sanitizeHexInput(e.target.value, 6))}
                  className="h-7 text-xs font-mono"
                  maxLength={6}
                  placeholder="FF0780"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">GPB</label>
                <Input
                  value={trailerGpb}
                  onChange={(e) => setTrailerGpb(sanitizeHexInput(e.target.value, 2))}
                  className="h-7 text-xs font-mono"
                  maxLength={2}
                  placeholder="69"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground">Preview</span>
            <div className="flex items-center gap-2 rounded border border-amber-500/20 bg-background/50 p-2">
              <code className="flex-1 break-all font-mono text-[10px] text-amber-400">
                {trailerPreview.match(/.{1,2}/g)?.join(" ")}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onCopyData(trailerPreview)}
                className="h-5 w-5 p-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {TRAILER_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTrailerKeyA(preset.keyA);
                  setTrailerKeyB(preset.keyB);
                  setTrailerAccess(preset.access);
                  setTrailerGpb(preset.gpb);
                }}
                className="h-5 px-1.5 text-[9px]"
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 flex-1 bg-amber-500 text-xs hover:bg-amber-600"
              onClick={() => onDataChange(selectedBlockData.index, trailerPreview)}
            >
              <Edit3 className="mr-1 h-3 w-3" />
              Apply
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 flex-1 text-xs"
              onClick={() => onWriteBlock(selectedBlockData.index, trailerPreview)}
              disabled={disabled}
            >
              <Upload className="mr-1 h-3 w-3" />
              Write
            </Button>
          </div>

          <div className="flex items-start gap-2 rounded bg-red-500/10 p-2 text-[9px] text-red-400">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>Writing incorrect access bits can permanently lock the sector!</span>
          </div>
        </div>
      ) : null}

      <div className="space-y-2 border-t pt-2">
        <span className="text-xs text-muted-foreground">Authentication</span>
        <div className="flex gap-2">
          <Input
            value={authKey}
            onChange={(e) => onAuthKeyChange(e.target.value.toUpperCase())}
            placeholder="Key (12 hex)"
            className="h-8 flex-1 text-xs font-mono"
            maxLength={12}
          />
          <Button
            size="sm"
            variant={authKeyType === "A" ? "default" : "outline"}
            className="h-8 w-10 text-xs"
            onClick={() => onAuthKeyTypeChange("A")}
          >
            A
          </Button>
          <Button
            size="sm"
            variant={authKeyType === "B" ? "default" : "outline"}
            className="h-8 w-10 text-xs"
            onClick={() => onAuthKeyTypeChange("B")}
          >
            B
          </Button>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          size="sm"
          className="h-8 flex-1 text-xs"
          onClick={() => onReadBlock(selectedBlockData.index)}
          disabled={disabled}
        >
          <Download className="mr-1 h-3 w-3" />
          Read
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 flex-1 text-xs"
          onClick={() => onWriteBlock(selectedBlockData.index, selectedBlockData.data)}
          disabled={disabled}
        >
          <Upload className="mr-1 h-3 w-3" />
          Write
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => onZeroBlock(selectedBlockData.index)}
          title="Zero block"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </>
  );
}
