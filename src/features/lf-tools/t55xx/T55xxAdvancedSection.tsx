import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Upload, ChevronDown, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

interface T55xxAdvancedSectionProps {
  blockNumber: string;
  blockData: string;
  onBlockNumberChange: (value: string) => void;
  onBlockDataChange: (value: string) => void;
  onReadBlock: () => void;
  onWriteBlock: () => void;
  disabled?: boolean;
}

export function T55xxAdvancedSection({
  blockNumber,
  blockData,
  onBlockNumberChange,
  onBlockDataChange,
  onReadBlock,
  onWriteBlock,
  disabled = false,
}: T55xxAdvancedSectionProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="border-t">
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-secondary/30"
      >
        <div className="flex items-center gap-2">
          <Cpu className="h-3 w-3 text-amber-500" />
          <span className="font-medium">Block Read/Write</span>
        </div>
        <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")} />
      </button>

      {showAdvanced && (
        <div className="space-y-3 bg-secondary/20 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Block (0-7)</label>
              <Input
                type="number"
                min={0}
                max={7}
                value={blockNumber}
                onChange={(e) => onBlockNumberChange(e.target.value)}
                className="h-8 font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Data (8 hex)</label>
              <Input
                value={blockData}
                onChange={(e) => onBlockDataChange(e.target.value)}
                placeholder="00000000"
                className="h-8 font-mono text-xs"
                maxLength={8}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onReadBlock}
              disabled={disabled}
              className="flex-1 gap-1"
            >
              <Download className="h-3 w-3" />
              Read Block
            </Button>
            <Button
              size="sm"
              onClick={onWriteBlock}
              disabled={disabled || blockData.length !== 8}
              className="flex-1 gap-1"
            >
              <Upload className="h-3 w-3" />
              Write Block
            </Button>
          </div>

          <div className="rounded border bg-background p-2 text-[10px] text-muted-foreground">
            <strong>Block 0 (Config):</strong> Contains modulation, bit rate, and password settings.
            <br />
            <strong>Block 7:</strong> Password block (if password protection enabled).
          </div>
        </div>
      )}
    </div>
  );
}
