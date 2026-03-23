import { cn } from "@/lib/utils";
import { Grid3X3 } from "lucide-react";
import { getAsciiChar, getByteColor, getGridClass, isPrintable } from "../utils";
import type { ByteView, ViewMode } from "../types";

interface HexViewerBodyProps {
  parsed: ByteView[];
  viewMode: ViewMode;
  hoverIndex: number | null;
  onHoverIndexChange: (value: number | null) => void;
  showOffsetDecimal: boolean;
}

export function HexViewerBody({
  parsed,
  viewMode,
  hoverIndex,
  onHoverIndexChange,
  showOffsetDecimal,
}: HexViewerBodyProps) {
  return (
    <div className="flex-1 overflow-auto">
      {parsed.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground">
          <Grid3X3 className="mb-2 h-8 w-8 opacity-50" />
          <p>Paste a hex dump to view bytes</p>
          <p className="mt-1 text-xs">Hover to highlight byte in both views</p>
        </div>
      ) : (
        <div className="min-w-fit">
          <div className={getGridClass(viewMode)}>
            <span className="text-muted-foreground">Offset</span>
            <span>Hex</span>
            <span>ASCII</span>
          </div>

          {parsed.map((row) => (
            <div
              key={row.offset}
              className={cn(
                "grid border-b border-border/30 px-3 py-1 text-[11px] font-mono transition-colors hover:bg-secondary/20",
                viewMode === "32"
                  ? "grid-cols-[70px_1fr_260px]"
                  : viewMode === "8"
                    ? "grid-cols-[70px_1fr_80px]"
                    : "grid-cols-[70px_1fr_160px]",
              )}
            >
              <span className="tabular-nums text-muted-foreground">
                {showOffsetDecimal
                  ? row.offset.toString().padStart(5, " ")
                  : row.offset.toString(16).padStart(4, "0").toUpperCase()}
              </span>

              <div className="flex flex-wrap gap-x-1">
                {row.bytes.map((byte, idx) => {
                  const globalIndex = row.offset + idx;
                  const isHighlighted = hoverIndex === globalIndex;

                  return (
                    <span
                      key={idx}
                      onMouseEnter={() => onHoverIndexChange(globalIndex)}
                      onMouseLeave={() => onHoverIndexChange(null)}
                      className={cn(
                        "cursor-default rounded px-0.5 tabular-nums transition-colors",
                        getByteColor(byte),
                        isHighlighted && "bg-primary/30 text-primary-foreground",
                      )}
                    >
                      {byte.toString(16).padStart(2, "0").toUpperCase()}
                    </span>
                  );
                })}
              </div>

              <div className="flex">
                {row.bytes.map((byte, idx) => {
                  const globalIndex = row.offset + idx;
                  const char = getAsciiChar(byte);
                  const isHighlighted = hoverIndex === globalIndex;

                  return (
                    <span
                      key={idx}
                      onMouseEnter={() => onHoverIndexChange(globalIndex)}
                      onMouseLeave={() => onHoverIndexChange(null)}
                      className={cn(
                        "w-[8px] cursor-default text-center transition-colors",
                        isPrintable(byte) ? "text-emerald-400" : "text-muted-foreground/50",
                        isHighlighted && "rounded bg-primary/30 text-primary-foreground",
                      )}
                    >
                      {char}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
