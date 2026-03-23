import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Copy, Lock, Play, RefreshCw, Shield, Upload } from "lucide-react";
import type { BlockRow } from "../types";
import { hexToAscii, isManufacturerBlock, isTrailerBlock } from "../lib/editorUtils";

interface MifareBlockTableProps {
  rows: BlockRow[];
  selectedRow: number | null;
  disabled?: boolean;
  onDataChange: (block: number, value: string) => void;
  onSelectRow: (block: number) => void;
  onReadBlock: (block: number) => void;
  onWriteBlock: (block: number, data: string) => void;
  onEmulatorGet: (block: number) => void;
  onCopy: (text: string) => void;
}

export function MifareBlockTable({
  rows,
  selectedRow,
  disabled,
  onDataChange,
  onSelectRow,
  onReadBlock,
  onWriteBlock,
  onEmulatorGet,
  onCopy,
}: MifareBlockTableProps) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-secondary/50">
          <tr className="border-b">
            <th className="w-14 px-3 py-2 text-left font-medium">Sec</th>
            <th className="w-14 px-3 py-2 text-left font-medium">Blk</th>
            <th className="px-3 py-2 text-left font-medium">Data (Hex)</th>
            <th className="w-36 px-3 py-2 text-left font-medium">ASCII</th>
            <th className="w-28 px-3 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const trailer = isTrailerBlock(row.block);
            const manufacturer = isManufacturerBlock(row.block);
            const selected = selectedRow === row.block;

            return (
              <tr
                key={row.block}
                className={cn(
                  "cursor-pointer border-b border-border/50 transition-colors",
                  selected && "bg-primary/10",
                  trailer && "bg-amber-500/5",
                  manufacturer && "bg-emerald-500/5",
                  !selected && "hover:bg-secondary/30",
                )}
                onClick={() => onSelectRow(row.block)}
              >
                <td className="px-3 py-1.5 font-mono text-muted-foreground">{row.sector}</td>
                <td className="px-3 py-1.5 font-mono">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">{row.block}</span>
                    {trailer ? <Lock className="h-3 w-3 text-amber-500" /> : null}
                    {manufacturer ? <Shield className="h-3 w-3 text-emerald-500" /> : null}
                  </div>
                </td>
                <td className="px-3 py-1.5">
                  <Input
                    value={row.data}
                    onChange={(e) => onDataChange(row.block, e.target.value)}
                    className={cn(
                      "h-7 text-[11px] tracking-wider font-mono",
                      row.dirty && "border-amber-500/50 bg-amber-500/5",
                    )}
                    onClick={(e) => e.stopPropagation()}
                    maxLength={32}
                  />
                </td>
                <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                  {hexToAscii(row.data)}
                </td>
                <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onReadBlock(row.block)}
                      disabled={disabled}
                      className="h-6 w-6 p-0"
                      title="Read"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onWriteBlock(row.block, row.data)}
                      disabled={disabled || row.data.length !== 32}
                      className="h-6 w-6 p-0"
                      title="Write"
                    >
                      <Upload className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEmulatorGet(row.block)}
                      disabled={disabled}
                      className="h-6 w-6 p-0"
                      title="Get from emulator"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onCopy(row.data)}
                      className="h-6 w-6 p-0"
                      title="Copy"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
