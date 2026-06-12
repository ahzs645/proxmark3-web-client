import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CapturedFrame, Protocol } from "./types";
import { TrafficEmptyState } from "./TrafficEmptyState";
import { decodeCommand, formatHex, formatTimestamp } from "./utils";

interface TrafficFrameTableProps {
  frames: CapturedFrame[];
  protocol: Protocol;
  showAnnotations: boolean;
  selectedFrame: string | null;
  onSelectFrame: (id: string) => void;
}

export function TrafficFrameTable({
  frames,
  protocol,
  showAnnotations,
  selectedFrame,
  onSelectFrame,
}: TrafficFrameTableProps) {
  if (frames.length === 0) {
    return <TrafficEmptyState />;
  }

  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-secondary/50">
        <tr className="border-b">
          <th className="w-24 px-3 py-2 text-left font-medium">Time</th>
          <th className="w-16 px-3 py-2 text-center font-medium">Dir</th>
          <th className="px-3 py-2 text-left font-medium">Data</th>
          <th className="w-16 px-3 py-2 text-center font-medium">CRC</th>
          {showAnnotations ? (
            <th className="w-40 px-3 py-2 text-left font-medium">Command</th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {frames.map((frame) => (
          <tr
            key={frame.id}
            className={cn(
              "cursor-pointer border-b border-border/50 transition-colors",
              selectedFrame === frame.id && "bg-primary/10",
              frame.direction === "reader" && "bg-blue-500/5",
              frame.direction === "tag" && "bg-green-500/5",
            )}
            onClick={() => onSelectFrame(frame.id)}
          >
            <td className="px-3 py-1.5 font-mono text-muted-foreground">
              {formatTimestamp(frame.timestamp)}
            </td>
            <td className="px-3 py-1.5 text-center">
              {frame.direction === "reader" ? (
                <Badge
                  variant="outline"
                  className="gap-0.5 text-[9px] text-blue-600 dark:text-blue-400"
                >
                  <ArrowRight className="h-2.5 w-2.5" />
                  Rdr
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-0.5 text-[9px] text-green-600 dark:text-green-400"
                >
                  <ArrowLeft className="h-2.5 w-2.5" />
                  Tag
                </Badge>
              )}
            </td>
            <td className="px-3 py-1.5">
              <code className="font-mono text-[11px]">{formatHex(frame.data)}</code>
            </td>
            <td className="px-3 py-1.5 text-center">
              {frame.crcValid !== undefined &&
                (frame.crcValid ? (
                  <CheckCircle className="inline h-3.5 w-3.5 text-green-500" />
                ) : (
                  <AlertCircle className="inline h-3.5 w-3.5 text-red-500" />
                ))}
            </td>
            {showAnnotations ? (
              <td className="px-3 py-1.5 text-muted-foreground">
                {frame.command || frame.annotation || decodeCommand(frame.data, protocol)}
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
