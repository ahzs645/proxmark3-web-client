import { Button } from "@/components/ui/button";
import { RefreshCw, Play, Square, Trash2, Download, Copy } from "lucide-react";
import { PROTOCOL_CONFIG } from "./utils";
import type { Protocol } from "./types";

interface TrafficProtocolControlsProps {
  protocol: Protocol;
  isCapturing: boolean;
  disabled: boolean;
  onProtocolChange: (protocol: Protocol) => void;
  onStartSniff: () => void;
  onStopSniff: () => void;
  onListTrace: () => void;
  onClearTrace: () => void;
  onCopyTrace: () => void;
  onExportTrace: () => void;
  hasFrames: boolean;
}

export function TrafficProtocolControls({
  protocol,
  isCapturing,
  disabled,
  onProtocolChange,
  onStartSniff,
  onStopSniff,
  onListTrace,
  onClearTrace,
  onCopyTrace,
  onExportTrace,
  hasFrames,
}: TrafficProtocolControlsProps) {
  return (
    <div className="bg-secondary/20 space-y-3 border-b p-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Protocol:</label>
        <div className="flex overflow-hidden rounded-md border">
          {(
            Object.entries(PROTOCOL_CONFIG) as [Protocol, (typeof PROTOCOL_CONFIG)[Protocol]][]
          ).map(([key, cfg]) => (
            <Button
              key={key}
              size="sm"
              variant={protocol === key ? "default" : "ghost"}
              onClick={() => onProtocolChange(key)}
              className="h-7 rounded-none px-3 text-xs"
              disabled={isCapturing}
            >
              {cfg.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!isCapturing ? (
          <Button size="sm" onClick={onStartSniff} disabled={disabled} className="gap-1">
            <Play className="h-3 w-3" />
            Start Sniff
          </Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={onStopSniff} className="gap-1">
            <Square className="h-3 w-3" />
            Stop
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onListTrace}
          disabled={disabled || isCapturing}
          className="gap-1"
        >
          <RefreshCw className="h-3 w-3" />
          List Trace
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onClearTrace}
          disabled={isCapturing}
          className="gap-1"
        >
          <Trash2 className="h-3 w-3" />
          Clear
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onCopyTrace}
            disabled={disabled || !hasFrames}
            className="gap-1"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onExportTrace}
            disabled={disabled || !hasFrames}
            className="gap-1"
          >
            <Download className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
