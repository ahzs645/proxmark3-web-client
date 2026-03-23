import { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrafficHeader } from "@/features/traffic/TrafficHeader";
import { TrafficProtocolControls } from "@/features/traffic/TrafficProtocolControls";
import { TrafficFilterBar } from "@/features/traffic/TrafficFilterBar";
import { TrafficFrameTable } from "@/features/traffic/TrafficFrameTable";
import { TrafficFrameDetails } from "@/features/traffic/TrafficFrameDetails";
import {
  DEMO_FRAMES,
  PROTOCOL_CONFIG,
  buildTraceText,
  downloadTraceJson,
} from "@/features/traffic/utils";
import type { CapturedFrame, Protocol, TrafficCapturePanelProps } from "@/features/traffic/types";

export function TrafficCapturePanel({ onCommand, disabled = false }: TrafficCapturePanelProps) {
  const [protocol, setProtocol] = useState<Protocol>("14a");
  const [isCapturing, setIsCapturing] = useState(false);
  const [frames, setFrames] = useState<CapturedFrame[]>(DEMO_FRAMES);
  const [filterDirection, setFilterDirection] = useState<"all" | "reader" | "tag">("all");
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);

  const config = PROTOCOL_CONFIG[protocol];

  const filteredFrames = useMemo(() => {
    if (filterDirection === "all") return frames;
    return frames.filter((f) => f.direction === filterDirection);
  }, [frames, filterDirection]);

  const handleStartSniff = useCallback(() => {
    setIsCapturing(true);
    onCommand(config.sniffCmd);
  }, [onCommand, config]);

  const handleStopSniff = useCallback(() => {
    setIsCapturing(false);
    // Send break signal - this would typically be handled by the parent
    onCommand(""); // Empty command or ctrl+c equivalent
  }, [onCommand]);

  const handleListTrace = useCallback(() => {
    onCommand(config.listCmd);
  }, [onCommand, config]);

  const handleClearTrace = useCallback(() => {
    setFrames([]);
    onCommand("trace clear");
  }, [onCommand]);

  const handleCopyTrace = useCallback(() => {
    void navigator.clipboard.writeText(buildTraceText(frames));
  }, [frames]);

  const handleExportTrace = useCallback(() => {
    downloadTraceJson(frames, protocol);
  }, [frames, protocol]);

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <TrafficHeader isCapturing={isCapturing} />

      <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
        <TrafficProtocolControls
          protocol={protocol}
          isCapturing={isCapturing}
          disabled={disabled}
          onProtocolChange={setProtocol}
          onStartSniff={handleStartSniff}
          onStopSniff={handleStopSniff}
          onListTrace={handleListTrace}
          onClearTrace={handleClearTrace}
          onCopyTrace={handleCopyTrace}
          onExportTrace={handleExportTrace}
          hasFrames={frames.length > 0}
        />

        <TrafficFilterBar
          filterDirection={filterDirection}
          showAnnotations={showAnnotations}
          filteredCount={filteredFrames.length}
          onFilterDirectionChange={setFilterDirection}
          onToggleAnnotations={() => setShowAnnotations(!showAnnotations)}
        />

        <div className="flex-1 overflow-auto">
          <TrafficFrameTable
            frames={filteredFrames}
            protocol={protocol}
            showAnnotations={showAnnotations}
            selectedFrame={selectedFrame}
            onSelectFrame={setSelectedFrame}
          />
        </div>

        <TrafficFrameDetails
          frame={frames.find((f) => f.id === selectedFrame) ?? null}
          onClose={() => setSelectedFrame(null)}
        />
      </CardContent>
    </Card>
  );
}

export default TrafficCapturePanel;
