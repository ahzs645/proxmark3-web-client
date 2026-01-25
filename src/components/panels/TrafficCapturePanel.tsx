import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Radio,
  Play,
  Square,
  Trash2,
  Download,
  Copy,
  ArrowRight,
  ArrowLeft,
  Filter,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Protocol = "14a" | "14b" | "15" | "iclass" | "lf";

interface CapturedFrame {
  id: string;
  timestamp: number;
  direction: "reader" | "tag";
  data: string;
  crc?: string;
  crcValid?: boolean;
  command?: string;
  annotation?: string;
}

interface TrafficCapturePanelProps {
  onCommand: (cmd: string) => void;
  disabled?: boolean;
}

// ISO14443-A command decoder
const ISO14443A_COMMANDS: Record<string, string> = {
  "26": "REQA (Request Type A)",
  "52": "WUPA (Wake-Up)",
  "93": "ANTICOL/SELECT CL1",
  "95": "ANTICOL/SELECT CL2",
  "97": "ANTICOL/SELECT CL3",
  "50": "HALT",
  "60": "AUTH Key A",
  "61": "AUTH Key B",
  "30": "READ",
  "A0": "WRITE",
  "C0": "INCREMENT",
  "C1": "DECREMENT",
  "C2": "RESTORE",
  "B0": "TRANSFER",
  "E0": "RATS (Request ATS)",
  "D0": "PPS",
  "B2": "I-BLOCK",
  "B3": "I-BLOCK",
  "A2": "R-BLOCK (ACK)",
  "A3": "R-BLOCK (ACK)",
  "BA": "R-BLOCK (NAK)",
  "BB": "R-BLOCK (NAK)",
  "S2": "S-BLOCK (WTX)",
  "F2": "S-BLOCK (DESELECT)",
};

// iCLASS command decoder
const ICLASS_COMMANDS: Record<string, string> = {
  "0A": "ACTALL",
  "0C": "IDENTIFY",
  "81": "SELECT",
  "88": "READCHECK",
  "82": "CHECK",
  "87": "READ",
  "89": "READ4",
  "06": "UPDATE",
  "8A": "DETECT",
  "0D": "PAGESEL",
  "07": "ACTALL",
};

function decodeCommand(data: string, protocol: Protocol): string | undefined {
  const firstByte = data.slice(0, 2).toUpperCase();

  if (protocol === "14a") {
    return ISO14443A_COMMANDS[firstByte];
  } else if (protocol === "iclass") {
    return ICLASS_COMMANDS[firstByte];
  }

  return undefined;
}

function formatTimestamp(ts: number): string {
  return ts.toFixed(3) + " ms";
}

function formatHex(hex: string, spaced = true): string {
  if (!spaced) return hex.toUpperCase();
  return hex.toUpperCase().match(/.{1,2}/g)?.join(" ") || hex;
}

const PROTOCOL_CONFIG: Record<Protocol, { label: string; sniffCmd: string; listCmd: string }> = {
  "14a": {
    label: "ISO14443-A",
    sniffCmd: "hf 14a sniff -c -r",
    listCmd: "trace list -t 14a -1",
  },
  "14b": {
    label: "ISO14443-B",
    sniffCmd: "hf 14b sniff",
    listCmd: "trace list -t 14b -1",
  },
  "15": {
    label: "ISO15693",
    sniffCmd: "hf 15 sniff",
    listCmd: "trace list -t 15 -1",
  },
  iclass: {
    label: "iCLASS",
    sniffCmd: "hf iclass sniff",
    listCmd: "trace list -t iclass -1",
  },
  lf: {
    label: "LF",
    sniffCmd: "lf sniff -s 50000",
    listCmd: "data plot",
  },
};

// Demo data for visualization
const DEMO_FRAMES: CapturedFrame[] = [
  { id: "1", timestamp: 0, direction: "reader", data: "26", crcValid: true, command: "REQA" },
  { id: "2", timestamp: 0.128, direction: "tag", data: "0400", crcValid: true, annotation: "ATQA" },
  { id: "3", timestamp: 1.024, direction: "reader", data: "9320", crcValid: true, command: "ANTICOL CL1" },
  { id: "4", timestamp: 1.152, direction: "tag", data: "88049A5D24", crcValid: true, annotation: "UID0" },
  { id: "5", timestamp: 2.048, direction: "reader", data: "937088049A5D2489", crcValid: true, command: "SELECT CL1" },
  { id: "6", timestamp: 2.176, direction: "tag", data: "0418", crcValid: true, annotation: "SAK" },
  { id: "7", timestamp: 3.072, direction: "reader", data: "6000F57B", crcValid: true, command: "AUTH Key A (Blk 0)" },
  { id: "8", timestamp: 3.584, direction: "tag", data: "A13B48D2", crcValid: true, annotation: "NT (nonce)" },
];

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
    const traceText = frames
      .map(
        (f) =>
          `${formatTimestamp(f.timestamp)} ${f.direction === "reader" ? ">>>" : "<<<"} ${f.data}${f.command ? ` (${f.command})` : ""}`
      )
      .join("\n");
    navigator.clipboard.writeText(traceText);
  }, [frames]);

  const handleExportTrace = useCallback(() => {
    const traceJson = JSON.stringify(frames, null, 2);
    const blob = new Blob([traceJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trace_${protocol}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [frames, protocol]);

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            Traffic Capture
            <Badge variant="outline" className="ml-1">
              Sniff & Trace
            </Badge>
          </CardTitle>
          <Badge variant={isCapturing ? "default" : "secondary"} className="animate-pulse">
            {isCapturing ? "Capturing..." : "Idle"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
        {/* Protocol Selector */}
        <div className="p-3 bg-secondary/20 border-b space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Protocol:</label>
            <div className="flex rounded-md overflow-hidden border">
              {(Object.entries(PROTOCOL_CONFIG) as [Protocol, typeof PROTOCOL_CONFIG[Protocol]][]).map(
                ([key, cfg]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={protocol === key ? "default" : "ghost"}
                    onClick={() => setProtocol(key)}
                    className="h-7 rounded-none text-xs px-3"
                    disabled={isCapturing}
                  >
                    {cfg.label}
                  </Button>
                )
              )}
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-2">
            {!isCapturing ? (
              <Button
                size="sm"
                onClick={handleStartSniff}
                disabled={disabled}
                className="gap-1"
              >
                <Play className="h-3 w-3" />
                Start Sniff
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleStopSniff}
                className="gap-1"
              >
                <Square className="h-3 w-3" />
                Stop
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleListTrace}
              disabled={disabled || isCapturing}
              className="gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              List Trace
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearTrace}
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
                onClick={handleCopyTrace}
                disabled={frames.length === 0}
                className="gap-1"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleExportTrace}
                disabled={frames.length === 0}
                className="gap-1"
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-3 py-2 border-b flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Filter:</span>
            <div className="flex rounded-md overflow-hidden border">
              {(["all", "reader", "tag"] as const).map((dir) => (
                <Button
                  key={dir}
                  size="sm"
                  variant={filterDirection === dir ? "default" : "ghost"}
                  onClick={() => setFilterDirection(dir)}
                  className="h-6 rounded-none text-[10px] px-2"
                >
                  {dir === "all" ? "All" : dir === "reader" ? "Reader" : "Tag"}
                </Button>
              ))}
            </div>
          </div>

          <Separator orientation="vertical" className="h-4" />

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowAnnotations(!showAnnotations)}
            className="h-6 text-[10px] gap-1"
          >
            {showAnnotations ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            Annotations
          </Button>

          <div className="ml-auto text-xs text-muted-foreground">
            {filteredFrames.length} frames
          </div>
        </div>

        {/* Traffic List */}
        <div className="flex-1 overflow-auto">
          {filteredFrames.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
              <Radio className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">No traffic captured</p>
              <p className="text-xs mt-1">Start a sniff session to capture traffic</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-secondary/50 sticky top-0">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium w-24">Time</th>
                  <th className="px-3 py-2 text-center font-medium w-16">Dir</th>
                  <th className="px-3 py-2 text-left font-medium">Data</th>
                  <th className="px-3 py-2 text-center font-medium w-16">CRC</th>
                  {showAnnotations && (
                    <th className="px-3 py-2 text-left font-medium w-40">Command</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredFrames.map((frame) => (
                  <tr
                    key={frame.id}
                    className={cn(
                      "border-b border-border/50 transition-colors cursor-pointer",
                      selectedFrame === frame.id && "bg-primary/10",
                      frame.direction === "reader" && "bg-blue-500/5",
                      frame.direction === "tag" && "bg-green-500/5"
                    )}
                    onClick={() => setSelectedFrame(frame.id)}
                  >
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">
                      {formatTimestamp(frame.timestamp)}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {frame.direction === "reader" ? (
                        <Badge variant="outline" className="text-[9px] gap-0.5 text-blue-400">
                          <ArrowRight className="h-2.5 w-2.5" />
                          Rdr
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] gap-0.5 text-green-400">
                          <ArrowLeft className="h-2.5 w-2.5" />
                          Tag
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <code className="font-mono text-[11px]">
                        {formatHex(frame.data)}
                      </code>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {frame.crcValid !== undefined && (
                        frame.crcValid ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500 inline" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-red-500 inline" />
                        )
                      )}
                    </td>
                    {showAnnotations && (
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {frame.command || frame.annotation || decodeCommand(frame.data, protocol)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Selected Frame Details */}
        {selectedFrame && (
          <div className="border-t p-3 bg-secondary/20">
            {(() => {
              const frame = frames.find((f) => f.id === selectedFrame);
              if (!frame) return null;
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium">Frame Details</label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedFrame(null)}
                      className="h-5 w-5 p-0"
                    >
                      ×
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 bg-background rounded">
                      <label className="text-[10px] text-muted-foreground block">
                        Timestamp
                      </label>
                      <span className="font-mono">{formatTimestamp(frame.timestamp)}</span>
                    </div>
                    <div className="p-2 bg-background rounded">
                      <label className="text-[10px] text-muted-foreground block">
                        Direction
                      </label>
                      <span>{frame.direction === "reader" ? "Reader → Tag" : "Tag → Reader"}</span>
                    </div>
                    <div className="p-2 bg-background rounded">
                      <label className="text-[10px] text-muted-foreground block">
                        Length
                      </label>
                      <span>{frame.data.length / 2} bytes</span>
                    </div>
                    <div className="p-2 bg-background rounded">
                      <label className="text-[10px] text-muted-foreground block">
                        CRC
                      </label>
                      <span>
                        {frame.crcValid === undefined
                          ? "N/A"
                          : frame.crcValid
                            ? "Valid"
                            : "Invalid"}
                      </span>
                    </div>
                  </div>
                  <div className="p-2 bg-background rounded">
                    <label className="text-[10px] text-muted-foreground block mb-1">
                      Raw Data
                    </label>
                    <code className="font-mono text-xs break-all">
                      {formatHex(frame.data)}
                    </code>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TrafficCapturePanel;
