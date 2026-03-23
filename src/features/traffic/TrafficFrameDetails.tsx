import { Button } from "@/components/ui/button";
import type { CapturedFrame } from "./types";
import { formatHex, formatTimestamp } from "./utils";

interface TrafficFrameDetailsProps {
  frame: CapturedFrame | null;
  onClose: () => void;
}

export function TrafficFrameDetails({ frame, onClose }: TrafficFrameDetailsProps) {
  if (!frame) return null;

  return (
    <div className="border-t bg-secondary/20 p-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Frame Details</label>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-5 w-5 p-0">
            ×
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <div className="rounded bg-background p-2">
            <label className="block text-[10px] text-muted-foreground">Timestamp</label>
            <span className="font-mono">{formatTimestamp(frame.timestamp)}</span>
          </div>
          <div className="rounded bg-background p-2">
            <label className="block text-[10px] text-muted-foreground">Direction</label>
            <span>{frame.direction === "reader" ? "Reader → Tag" : "Tag → Reader"}</span>
          </div>
          <div className="rounded bg-background p-2">
            <label className="block text-[10px] text-muted-foreground">Length</label>
            <span>{frame.data.length / 2} bytes</span>
          </div>
          <div className="rounded bg-background p-2">
            <label className="block text-[10px] text-muted-foreground">CRC</label>
            <span>
              {frame.crcValid === undefined ? "N/A" : frame.crcValid ? "Valid" : "Invalid"}
            </span>
          </div>
        </div>
        <div className="rounded bg-background p-2">
          <label className="mb-1 block text-[10px] text-muted-foreground">Raw Data</label>
          <code className="break-all font-mono text-xs">{formatHex(frame.data)}</code>
        </div>
      </div>
    </div>
  );
}
