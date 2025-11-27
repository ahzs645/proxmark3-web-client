import { useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CachedAsset } from "./KeyCachePanel";
import {
  Database,
  Copy,
  Trash2,
  FileCode2,
  Columns,
  Grid3X3,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HexAsciiViewerProps {
  dumps: CachedAsset[];
}

type ByteView = {
  offset: number;
  bytes: number[];
};

type ViewMode = "16" | "32" | "8";

function toByteView(hexString: string, bytesPerRow: number = 16): ByteView[] {
  const clean = hexString.replace(/[^a-fA-F0-9]/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    const byte = clean.slice(i, i + 2);
    if (byte.length === 2) {
      bytes.push(parseInt(byte, 16));
    }
  }
  const rows: ByteView[] = [];
  for (let i = 0; i < bytes.length; i += bytesPerRow) {
    rows.push({ offset: i, bytes: bytes.slice(i, i + bytesPerRow) });
  }
  return rows;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getByteColor(byte: number): string {
  if (byte === 0x00) return "text-muted-foreground/50";
  if (byte === 0xff) return "text-rose-400";
  if (byte >= 0x20 && byte <= 0x7e) return "text-emerald-400"; // Printable ASCII
  return "text-foreground";
}

export function HexAsciiViewer({ dumps }: HexAsciiViewerProps) {
  const [input, setInput] = useState("");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("16");
  const [showOffsetDecimal, setShowOffsetDecimal] = useState(false);

  const dumpChoices = useMemo(
    () => dumps.filter((d) => d.kind === "dump" && d.base64),
    [dumps]
  );

  const loadFromCache = useCallback((hexString: string) => {
    setInput(hexString);
  }, []);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(input.replace(/\s/g, ""));
  }, [input]);

  const bytesPerRow = parseInt(viewMode, 10);
  const parsed = useMemo(() => toByteView(input, bytesPerRow), [input, bytesPerRow]);

  const totalBytes = useMemo(() => {
    const clean = input.replace(/[^a-fA-F0-9]/g, "");
    return Math.floor(clean.length / 2);
  }, [input]);

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-primary" />
            Hex/ASCII Viewer
            {totalBytes > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {totalBytes} bytes
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {/* View mode toggle */}
            <div className="flex rounded-md overflow-hidden border mr-2">
              <Button
                size="sm"
                variant={viewMode === "8" ? "default" : "ghost"}
                onClick={() => setViewMode("8")}
                className="h-7 w-8 rounded-none text-[10px] p-0"
                title="8 bytes per row"
              >
                8
              </Button>
              <Button
                size="sm"
                variant={viewMode === "16" ? "default" : "ghost"}
                onClick={() => setViewMode("16")}
                className="h-7 w-8 rounded-none text-[10px] p-0"
                title="16 bytes per row"
              >
                16
              </Button>
              <Button
                size="sm"
                variant={viewMode === "32" ? "default" : "ghost"}
                onClick={() => setViewMode("32")}
                className="h-7 w-8 rounded-none text-[10px] p-0"
                title="32 bytes per row"
              >
                32
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowOffsetDecimal(!showOffsetDecimal)}
              className="h-7 w-7 p-0"
              title={showOffsetDecimal ? "Show hex offset" : "Show decimal offset"}
            >
              <ArrowUpDown className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={copyToClipboard}
              disabled={!input}
              className="h-7 w-7 p-0"
              title="Copy hex"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setInput("")}
              disabled={!input}
              className="h-7 w-7 p-0"
              title="Clear"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Input area */}
        <div className="p-3 border-b space-y-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste hex dump here (e.g., 3DD6CCC2E5088400...)&#10;&#10;Or load from a cached dump below"
            className="w-full min-h-[80px] rounded-md border border-border bg-secondary/30 p-2 font-mono text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {dumpChoices.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Database className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Load:</span>
              {dumpChoices.slice(0, 4).map((d) => (
                <Button
                  key={d.id}
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!d.base64) return;
                    const binary = atob(d.base64);
                    const arr = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) {
                      arr[i] = binary.charCodeAt(i);
                    }
                    loadFromCache(bytesToHex(arr));
                  }}
                  className="h-6 text-[10px]"
                >
                  {d.name}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Hex viewer */}
        <div className="flex-1 overflow-auto">
          {parsed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground text-sm py-12">
              <Grid3X3 className="h-8 w-8 mb-2 opacity-50" />
              <p>Paste a hex dump to view bytes</p>
              <p className="text-xs mt-1">Hover to highlight byte in both views</p>
            </div>
          ) : (
            <div className="min-w-fit">
              {/* Header */}
              <div
                className={cn(
                  "grid bg-secondary/50 px-3 py-2 text-[10px] font-semibold sticky top-0 border-b",
                  viewMode === "32"
                    ? "grid-cols-[70px_1fr_260px]"
                    : viewMode === "8"
                    ? "grid-cols-[70px_1fr_80px]"
                    : "grid-cols-[70px_1fr_160px]"
                )}
              >
                <span className="text-muted-foreground">Offset</span>
                <span>Hex</span>
                <span>ASCII</span>
              </div>

              {/* Data rows */}
              {parsed.map((row) => (
                <div
                  key={row.offset}
                  className={cn(
                    "grid px-3 py-1 border-b border-border/30 text-[11px] font-mono hover:bg-secondary/20 transition-colors",
                    viewMode === "32"
                      ? "grid-cols-[70px_1fr_260px]"
                      : viewMode === "8"
                      ? "grid-cols-[70px_1fr_80px]"
                      : "grid-cols-[70px_1fr_160px]"
                  )}
                >
                  {/* Offset */}
                  <span className="text-muted-foreground tabular-nums">
                    {showOffsetDecimal
                      ? row.offset.toString().padStart(5, " ")
                      : row.offset.toString(16).padStart(4, "0").toUpperCase()}
                  </span>

                  {/* Hex bytes */}
                  <div className="flex flex-wrap gap-x-1">
                    {row.bytes.map((b, idx) => {
                      const globalIndex = row.offset + idx;
                      const isHighlighted = hoverIndex === globalIndex;
                      const colorClass = getByteColor(b);

                      return (
                        <span
                          key={idx}
                          onMouseEnter={() => setHoverIndex(globalIndex)}
                          onMouseLeave={() => setHoverIndex(null)}
                          className={cn(
                            "px-0.5 rounded tabular-nums cursor-default transition-colors",
                            colorClass,
                            isHighlighted && "bg-primary/30 text-primary-foreground"
                          )}
                        >
                          {b.toString(16).padStart(2, "0").toUpperCase()}
                        </span>
                      );
                    })}
                  </div>

                  {/* ASCII */}
                  <div className="flex">
                    {row.bytes.map((b, idx) => {
                      const globalIndex = row.offset + idx;
                      const char = b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".";
                      const isHighlighted = hoverIndex === globalIndex;
                      const isPrintable = b >= 0x20 && b <= 0x7e;

                      return (
                        <span
                          key={idx}
                          onMouseEnter={() => setHoverIndex(globalIndex)}
                          onMouseLeave={() => setHoverIndex(null)}
                          className={cn(
                            "w-[8px] text-center cursor-default transition-colors",
                            isPrintable ? "text-emerald-400" : "text-muted-foreground/50",
                            isHighlighted && "bg-primary/30 text-primary-foreground rounded"
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

        {/* Stats bar */}
        {totalBytes > 0 && (
          <div className="px-3 py-2 border-t bg-secondary/30 text-[10px] text-muted-foreground flex items-center gap-4">
            <span>
              <span className="text-foreground font-medium">{totalBytes}</span> bytes
            </span>
            <span>
              <span className="text-foreground font-medium">{parsed.length}</span> rows
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Printable
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                0xFF
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                0x00
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default HexAsciiViewer;
