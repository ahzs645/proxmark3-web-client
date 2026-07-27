import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import type { CachedAsset } from "./KeyCachePanel";
import type { CachedDump } from "./CardMemoryMap";
import { HexViewerHeader } from "@/features/hex-viewer/components/HexViewerHeader";
import { HexInputPanel } from "@/features/hex-viewer/components/HexInputPanel";
import { HexViewerBody } from "@/features/hex-viewer/components/HexViewerBody";
import { HexStatsBar } from "@/features/hex-viewer/components/HexStatsBar";
import { toByteView } from "@/features/hex-viewer/utils";
import type { ViewMode } from "@/features/hex-viewer/types";

interface HexAsciiViewerProps {
  dumps: CachedAsset[];
  /** The card the workbench is working on, seeded into the viewer on arrival. */
  activeDump?: CachedDump | null;
}

/** Flatten a pm3 dump's blocks into one hex string, in block order. */
function dumpToHex(dump: CachedDump | null | undefined): string {
  const blocks = dump?.data.blocks;
  if (!blocks) return "";
  return Object.keys(blocks)
    .map((key) => Number(key))
    .filter((index) => Number.isFinite(index))
    .sort((a, b) => a - b)
    .map((index) => blocks[String(index)])
    .join("")
    .toUpperCase();
}

export function HexAsciiViewer({ dumps, activeDump }: HexAsciiViewerProps) {
  const [input, setInput] = useState("");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("16");
  const [showOffsetDecimal, setShowOffsetDecimal] = useState(false);

  // Arriving here with a card already loaded should show that card, not a blank
  // box — but never clobber hex the user pasted or loaded themselves.
  const seededDumpIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeDump || seededDumpIdRef.current === activeDump.id) return;
    const hex = dumpToHex(activeDump);
    if (!hex) return;
    setInput((current) => (current.trim() ? current : hex));
    seededDumpIdRef.current = activeDump.id;
  }, [activeDump]);

  const dumpChoices = useMemo(() => dumps.filter((d) => d.kind === "dump" && d.base64), [dumps]);
  const activeDumpSource = useMemo(() => {
    const hex = dumpToHex(activeDump);
    return activeDump && hex ? { name: activeDump.name, hex } : null;
  }, [activeDump]);

  const loadFromCache = useCallback((hexString: string) => {
    setInput(hexString);
  }, []);

  const copyToClipboard = useCallback(() => {
    void navigator.clipboard.writeText(input.replace(/\s/g, ""));
  }, [input]);

  const bytesPerRow = parseInt(viewMode, 10);
  const parsed = useMemo(() => toByteView(input, bytesPerRow), [input, bytesPerRow]);

  const totalBytes = useMemo(() => {
    const clean = input.replace(/[^a-fA-F0-9]/g, "");
    return Math.floor(clean.length / 2);
  }, [input]);

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <HexViewerHeader
        totalBytes={totalBytes}
        viewMode={viewMode}
        showOffsetDecimal={showOffsetDecimal}
        hasInput={Boolean(input)}
        onViewModeChange={setViewMode}
        onToggleOffsetMode={() => setShowOffsetDecimal((value) => !value)}
        onCopy={copyToClipboard}
        onClear={() => setInput("")}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <HexInputPanel
          dumps={dumpChoices}
          input={input}
          onInputChange={setInput}
          onLoadDump={loadFromCache}
          activeDump={activeDumpSource}
        />

        <HexViewerBody
          parsed={parsed}
          viewMode={viewMode}
          hoverIndex={hoverIndex}
          onHoverIndexChange={setHoverIndex}
          showOffsetDecimal={showOffsetDecimal}
        />

        <HexStatsBar totalBytes={totalBytes} rowCount={parsed.length} />
      </div>
    </Card>
  );
}

export default HexAsciiViewer;
