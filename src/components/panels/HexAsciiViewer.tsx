import { useCallback, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import type { CachedAsset } from "./KeyCachePanel";
import { HexViewerHeader } from "@/features/hex-viewer/components/HexViewerHeader";
import { HexInputPanel } from "@/features/hex-viewer/components/HexInputPanel";
import { HexViewerBody } from "@/features/hex-viewer/components/HexViewerBody";
import { HexStatsBar } from "@/features/hex-viewer/components/HexStatsBar";
import { toByteView } from "@/features/hex-viewer/utils";
import type { ViewMode } from "@/features/hex-viewer/types";

interface HexAsciiViewerProps {
  dumps: CachedAsset[];
}

export function HexAsciiViewer({ dumps }: HexAsciiViewerProps) {
  const [input, setInput] = useState("");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("16");
  const [showOffsetDecimal, setShowOffsetDecimal] = useState(false);

  const dumpChoices = useMemo(() => dumps.filter((d) => d.kind === "dump" && d.base64), [dumps]);

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
