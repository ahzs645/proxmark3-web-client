import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SectorGroup, SectorKeysRecord } from "@/features/memory/types";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Copy, Key, Lock, Play, RefreshCw, Upload } from "lucide-react";
import { hexToAscii } from "@/features/memory/lib/trailer";

interface MemoryTableProps {
  filteredSectors: SectorGroup[];
  sectorKeys: SectorKeysRecord;
  expandedSectors: Set<number>;
  selectedBlock: number | null;
  showKeys: boolean;
  disabled: boolean;
  onToggleSector: (sector: number) => void;
  onSelectBlock: (blockIndex: number) => void;
  onDataChange: (blockIndex: number, value: string) => void;
  onReadBlock: (blockIndex: number) => void;
  onWriteBlock: (blockIndex: number, data: string) => void;
  onEmulatorGet: (blockIndex: number) => void;
  onCopyData: (data: string) => void;
}

export function MemoryTable({
  filteredSectors,
  sectorKeys,
  expandedSectors,
  selectedBlock,
  showKeys,
  disabled,
  onToggleSector,
  onSelectBlock,
  onDataChange,
  onReadBlock,
  onWriteBlock,
  onEmulatorGet,
  onCopyData,
}: MemoryTableProps) {
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-secondary/50">
        <tr className="border-b">
          <th className="w-16 px-3 py-2 text-left font-medium">Sec</th>
          <th className="w-16 px-3 py-2 text-left font-medium">Blk</th>
          <th className="w-20 px-3 py-2 text-left font-medium">Type</th>
          <th className="px-3 py-2 text-left font-medium">Data (Hex)</th>
          <th className="w-36 px-3 py-2 text-left font-medium">ASCII</th>
          <th className="w-24 px-3 py-2 text-right font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {filteredSectors.map(([sectorNum, sectorBlocks]) => {
          const keys = sectorKeys[sectorNum.toString()];
          const emptyCount = sectorBlocks.filter(
            (block) =>
              block.kind === "data" &&
              block.data.replace(/\s/g, "") === "00000000000000000000000000000000",
          ).length;
          const dataBlockCount = sectorBlocks.filter((block) => block.kind === "data").length;
          const hasData = emptyCount < dataBlockCount;

          return (
            <Fragment key={`sector-group-${sectorNum}`}>
              <tr
                className={cn(
                  "cursor-pointer bg-secondary/30 transition-colors hover:bg-secondary/50",
                  !hasData && "opacity-60",
                )}
                onClick={() => onToggleSector(sectorNum)}
              >
                <td colSpan={6} className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    {expandedSectors.has(sectorNum) ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <span className="font-medium">Sector {sectorNum}</span>
                    <Badge variant="outline" className="h-4 text-[10px]">
                      {sectorBlocks.length} blocks
                    </Badge>
                    {emptyCount > 0 ? (
                      <Badge
                        variant="outline"
                        className="h-4 border-zinc-500/20 bg-zinc-500/10 text-[10px] text-zinc-400"
                      >
                        {emptyCount === dataBlockCount ? "All Empty" : `${emptyCount} empty`}
                      </Badge>
                    ) : null}
                    {showKeys && keys ? (
                      <>
                        <div className="ml-2 flex items-center gap-1">
                          <Key className="h-2.5 w-2.5 text-emerald-500" />
                          <code className="text-[10px] font-mono text-emerald-400">
                            {keys.KeyA}
                          </code>
                        </div>
                        <div className="flex items-center gap-1">
                          <Key className="h-2.5 w-2.5 text-blue-500" />
                          <code className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                            {keys.KeyB}
                          </code>
                        </div>
                      </>
                    ) : sectorBlocks.some((block) => block.kind === "trailer") ? (
                      <Badge
                        variant="secondary"
                        className="h-4 border-amber-500/30 bg-amber-500/20 text-[10px] text-amber-600 dark:text-amber-400"
                      >
                        <Lock className="mr-0.5 h-2.5 w-2.5" />
                        Protected
                      </Badge>
                    ) : null}
                  </div>
                </td>
              </tr>

              {expandedSectors.has(sectorNum)
                ? sectorBlocks.map((block) => {
                    const isSelected = selectedBlock === block.index;
                    const isTrailer = block.kind === "trailer";
                    const isManufacturer = block.kind === "manufacturer";
                    const isEmpty =
                      block.data.replace(/\s/g, "") === "00000000000000000000000000000000";

                    return (
                      <tr
                        key={block.index}
                        className={cn(
                          "cursor-pointer border-b border-border/50 transition-colors",
                          isSelected ? "bg-primary/10" : "hover:bg-secondary/30",
                          isTrailer && "bg-amber-500/5",
                          isEmpty && !isTrailer && "opacity-50",
                        )}
                        onClick={() => onSelectBlock(block.index)}
                      >
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">
                          {block.sector}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">
                          {block.index}
                        </td>
                        <td className="px-3 py-1.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-4 text-[10px]",
                              isManufacturer &&
                                "border-emerald-500/30 bg-emerald-500/20 text-emerald-400",
                              isTrailer &&
                                "border-amber-500/30 bg-amber-500/20 text-amber-600 dark:text-amber-400",
                              block.kind === "data" &&
                                !isEmpty &&
                                "bg-secondary text-secondary-foreground",
                              isEmpty &&
                                !isTrailer &&
                                "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
                            )}
                          >
                            {isEmpty && !isTrailer && !isManufacturer ? "Empty" : block.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-1.5 font-mono">
                          <Input
                            value={block.data}
                            onChange={(e) => onDataChange(block.index, e.target.value)}
                            className={cn(
                              "h-7 text-[11px] font-mono tracking-wider",
                              block.dirty && "border-amber-500/50 bg-amber-500/5",
                            )}
                            onClick={(e) => e.stopPropagation()}
                            maxLength={32}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-[11px] font-mono text-muted-foreground">
                          {hexToAscii(block.data)}
                        </td>
                        <td className="px-3 py-1.5">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => onReadBlock(block.index)}
                              disabled={disabled}
                              title="Read from card"
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant={block.dirty ? "default" : "ghost"}
                              className={cn(
                                "h-6 w-6 p-0",
                                block.dirty && "bg-amber-500 hover:bg-amber-600",
                              )}
                              onClick={() => onWriteBlock(block.index, block.data)}
                              disabled={disabled || block.data.replace(/\s/g, "").length !== 32}
                              title="Write to card"
                            >
                              <Upload className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => onEmulatorGet(block.index)}
                              disabled={disabled}
                              title="Get from emulator"
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => onCopyData(block.data)}
                              title="Copy"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
