import { useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CachedAsset } from "./KeyCachePanel";
import {
  Edit3,
  Download,
  Upload,
  Play,
  Save,
  Shield,
  Database,
  Wand2,
  Key,
  Copy,
  RefreshCw,
  ChevronDown,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type KeyType = "A" | "B";

interface BlockRow {
  sector: number;
  block: number;
  data: string;
  dirty?: boolean;
}

interface MifareEditorPanelProps {
  onCommand: (cmd: string) => void;
  cacheItems: CachedAsset[];
  disabled?: boolean;
  cachePathPrefix: string;
}

const demoRows: BlockRow[] = [
  { sector: 0, block: 0, data: "3D06CCC2E5884400E29346321A2761D9" },
  { sector: 0, block: 1, data: "00000000000000000000000000000000" },
  { sector: 0, block: 2, data: "1B5EA82A9555FF07BB67C33BAA3572FB" },
  { sector: 0, block: 3, data: "A0A1A2A3A4A586878688FFFF078069FF" },
  { sector: 1, block: 4, data: "00000000000000000000000000000000" },
  { sector: 1, block: 5, data: "156AAAD3A55FFF07BB69A2E35F7E7EB7" },
  { sector: 1, block: 6, data: "00000000000000000000000000000000" },
  { sector: 1, block: 7, data: "FF078069FFFF00000000000000000000" },
  { sector: 2, block: 8, data: "00000000000000000000000000000000" },
  { sector: 2, block: 9, data: "29FF1DA53355FF07BB69A2E35F7E7EB7" },
  { sector: 2, block: 10, data: "00000000000000000000000000000000" },
  { sector: 2, block: 11, data: "FF078069FFFF00000000000000000000" },
];

const isTrailerBlock = (block: number) => block % 4 === 3;
const isManufacturerBlock = (block: number) => block === 0;

function hexToAscii(hex: string): string {
  const clean = hex.replace(/\s/g, "");
  let result = "";
  for (let i = 0; i < clean.length; i += 2) {
    const byte = parseInt(clean.slice(i, i + 2), 16);
    result += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".";
  }
  return result;
}

export function MifareEditorPanel({ onCommand, cacheItems, disabled, cachePathPrefix }: MifareEditorPanelProps) {
  const [rows, setRows] = useState<BlockRow[]>(demoRows);
  const [key, setKey] = useState("FFFFFFFFFFFF");
  const [keyType, setKeyType] = useState<KeyType>("A");
  const [targetBlock, setTargetBlock] = useState("0");
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [showTrailerBuilder, setShowTrailerBuilder] = useState(false);

  // Trailer builder state
  const [trailerBlock, setTrailerBlock] = useState("3");
  const [trailerKeyA, setTrailerKeyA] = useState("FFFFFFFFFFFF");
  const [trailerKeyB, setTrailerKeyB] = useState("FFFFFFFFFFFF");
  const [trailerAccess, setTrailerAccess] = useState("FF0780");
  const [trailerGpb, setTrailerGpb] = useState("69");

  const dumpChoices = useMemo(() => cacheItems.filter((c) => c.kind === "dump"), [cacheItems]);
  const keyChoices = useMemo(() => cacheItems.filter((c) => c.kind === "keys"), [cacheItems]);
  const resolvePath = useCallback(
    (item: CachedAsset) => `${cachePathPrefix}/${item.relativePath || item.name}`,
    [cachePathPrefix]
  );

  const handleDataChange = useCallback((block: number, value: string) => {
    const sanitized = value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 32);
    setRows((prev) =>
      prev.map((r) => (r.block === block ? { ...r, data: sanitized, dirty: true } : r))
    );
  }, []);

  const writeBlock = useCallback(
    (block: number, data: string) => {
      if (!data || data.length !== 32) return;
      const cmd = `hf mf wrbl ${block} ${keyType.toLowerCase()} ${key} ${data}`;
      onCommand(cmd);
    },
    [onCommand, key, keyType]
  );

  const readBlock = useCallback(
    (block: number) => {
      const cmd = `hf mf rdbl ${block} ${keyType.toLowerCase()} ${key}`;
      onCommand(cmd);
    },
    [onCommand, key, keyType]
  );

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const trailerPreview = useMemo(() => {
    const paddedA = trailerKeyA.padEnd(12, "F").slice(0, 12).toUpperCase();
    const paddedB = trailerKeyB.padEnd(12, "F").slice(0, 12).toUpperCase();
    const access = trailerAccess.padEnd(6, "0").slice(0, 6).toUpperCase();
    const gpb = trailerGpb.padEnd(2, "0").slice(0, 2).toUpperCase();
    return `${paddedA}${access}${gpb}${paddedB}`;
  }, [trailerKeyA, trailerKeyB, trailerAccess, trailerGpb]);

  const trailerPresets = [
    { label: "Transport", keyA: "FFFFFFFFFFFF", keyB: "FFFFFFFFFFFF", access: "FF0780", gpb: "69" },
    { label: "KeyB Protected", keyA: "FFFFFFFFFFFF", keyB: "FFFFFFFFFFFF", access: "7F0788", gpb: "69" },
    { label: "Read-Only", keyA: "FFFFFFFFFFFF", keyB: "FFFFFFFFFFFF", access: "078F00", gpb: "69" },
  ];

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            MIFARE Classic Editor
            <Badge variant="outline" className="ml-1">1K/4K</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCommand("hf mf dump")}
              disabled={disabled}
              className="h-7 text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Dump
            </Button>
            <Button
              size="sm"
              onClick={() => onCommand("hf mf autopwn --1k")}
              disabled={disabled}
              className="h-7 text-xs"
            >
              <Key className="h-3 w-3 mr-1" />
              Autopwn
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-0">
        {/* Authentication Bar */}
        <div className="p-3 bg-secondary/30 border-b space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Auth:</span>
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-F0-9]/gi, ""))}
                placeholder="Key (12 hex)"
                className="w-32 h-8 text-xs font-mono"
                maxLength={12}
              />
              <div className="flex rounded-md overflow-hidden border">
                <Button
                  size="sm"
                  variant={keyType === "A" ? "default" : "ghost"}
                  onClick={() => setKeyType("A")}
                  className="h-8 w-10 rounded-none text-xs"
                >
                  A
                </Button>
                <Button
                  size="sm"
                  variant={keyType === "B" ? "default" : "ghost"}
                  onClick={() => setKeyType("B")}
                  className="h-8 w-10 rounded-none text-xs"
                >
                  B
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">Block:</span>
              <Input
                value={targetBlock}
                onChange={(e) => setTargetBlock(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className="w-16 h-8 text-xs font-mono"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => readBlock(Number(targetBlock))}
                disabled={disabled}
                className="h-8 text-xs"
              >
                <Download className="h-3 w-3 mr-1" />
                Read
              </Button>
            </div>
          </div>

          {/* Cache Files */}
          {(dumpChoices.length > 0 || keyChoices.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Database className="h-3 w-3 text-muted-foreground" />
              {dumpChoices.slice(0, 2).map((d) => (
                <Button
                  key={d.id}
                  size="sm"
                  variant="ghost"
                  onClick={() => onCommand(`hf mf eload -f ${resolvePath(d)}`)}
                  disabled={disabled}
                  className="h-6 text-[10px]"
                >
                  {d.relativePath || d.name}
                </Button>
              ))}
              {keyChoices.slice(0, 2).map((k) => (
                <Button
                  key={k.id}
                  size="sm"
                  variant="ghost"
                  onClick={() => onCommand(`mem load -f ${resolvePath(k)} --mfc`)}
                  disabled={disabled}
                  className="h-6 text-[10px]"
                >
                  <Key className="h-2.5 w-2.5 mr-1" />
                  {k.relativePath || k.name}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Block Table */}
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-secondary/50 sticky top-0">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium w-14">Sec</th>
                <th className="px-3 py-2 text-left font-medium w-14">Blk</th>
                <th className="px-3 py-2 text-left font-medium">Data (Hex)</th>
                <th className="px-3 py-2 text-left font-medium w-36">ASCII</th>
                <th className="px-3 py-2 text-right font-medium w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isTrailer = isTrailerBlock(row.block);
                const isManufacturer = isManufacturerBlock(row.block);
                const isSelected = selectedRow === row.block;

                return (
                  <tr
                    key={row.block}
                    className={cn(
                      "border-b border-border/50 transition-colors cursor-pointer",
                      isSelected && "bg-primary/10",
                      isTrailer && "bg-amber-500/5",
                      isManufacturer && "bg-emerald-500/5",
                      !isSelected && "hover:bg-secondary/30"
                    )}
                    onClick={() => setSelectedRow(row.block)}
                  >
                    <td className="px-3 py-1.5 text-muted-foreground font-mono">
                      {row.sector}
                    </td>
                    <td className="px-3 py-1.5 font-mono">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">{row.block}</span>
                        {isTrailer && (
                          <Lock className="h-3 w-3 text-amber-500" />
                        )}
                        {isManufacturer && (
                          <Shield className="h-3 w-3 text-emerald-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        value={row.data}
                        onChange={(e) => handleDataChange(row.block, e.target.value)}
                        className={cn(
                          "h-7 text-[11px] font-mono tracking-wider",
                          row.dirty && "border-amber-500/50 bg-amber-500/5"
                        )}
                        onClick={(e) => e.stopPropagation()}
                        maxLength={32}
                      />
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                      {hexToAscii(row.data)}
                    </td>
                    <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => readBlock(row.block)}
                          disabled={disabled}
                          className="h-6 w-6 p-0"
                          title="Read"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => writeBlock(row.block, row.data)}
                          disabled={disabled || row.data.length !== 32}
                          className="h-6 w-6 p-0"
                          title="Write"
                        >
                          <Upload className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onCommand(`hf mf eget ${row.block}`)}
                          disabled={disabled}
                          className="h-6 w-6 p-0"
                          title="Get from emulator"
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(row.data)}
                          className="h-6 w-6 p-0"
                          title="Copy"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Trailer Builder Section */}
        <div className="border-t">
          <button
            onClick={() => setShowTrailerBuilder(!showTrailerBuilder)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Wand2 className="h-3 w-3 text-amber-500" />
              <span className="font-medium">Sector Trailer Builder</span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                showTrailerBuilder && "rotate-180"
              )}
            />
          </button>

          {showTrailerBuilder && (
            <div className="p-3 bg-secondary/20 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Target Block</label>
                  <Input
                    value={trailerBlock}
                    onChange={(e) => setTrailerBlock(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Key A</label>
                  <Input
                    value={trailerKeyA}
                    onChange={(e) => setTrailerKeyA(e.target.value.toUpperCase())}
                    className="h-8 text-xs font-mono"
                    maxLength={12}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Key B</label>
                  <Input
                    value={trailerKeyB}
                    onChange={(e) => setTrailerKeyB(e.target.value.toUpperCase())}
                    className="h-8 text-xs font-mono"
                    maxLength={12}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Access + GPB</label>
                  <div className="flex gap-1">
                    <Input
                      value={trailerAccess}
                      onChange={(e) => setTrailerAccess(e.target.value.toUpperCase())}
                      className="h-8 text-xs font-mono flex-1"
                      maxLength={6}
                      placeholder="FF0780"
                    />
                    <Input
                      value={trailerGpb}
                      onChange={(e) => setTrailerGpb(e.target.value.toUpperCase())}
                      className="h-8 text-xs font-mono w-12"
                      maxLength={2}
                      placeholder="69"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-2 p-2 bg-background rounded border">
                <Badge variant="outline" className="text-[10px]">Preview</Badge>
                <code className="text-[11px] font-mono flex-1 text-amber-400">
                  {trailerPreview.match(/.{1,2}/g)?.join(" ")}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(trailerPreview)}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-2">
                {trailerPresets.map((preset) => (
                  <Button
                    key={preset.label}
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setTrailerKeyA(preset.keyA);
                      setTrailerKeyB(preset.keyB);
                      setTrailerAccess(preset.access);
                      setTrailerGpb(preset.gpb);
                    }}
                    className="h-6 text-[10px]"
                  >
                    <Wand2 className="h-2.5 w-2.5 mr-1" />
                    {preset.label}
                  </Button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    onCommand(
                      `hf mf wrbl ${trailerBlock} ${keyType.toLowerCase()} ${key} ${trailerPreview}`
                    )
                  }
                  disabled={disabled || trailerPreview.length !== 32}
                  className="h-8 text-xs"
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Write Trailer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onCommand(`hf mf rdbl ${trailerBlock} ${keyType.toLowerCase()} ${key}`)
                  }
                  disabled={disabled}
                  className="h-8 text-xs"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Read Current
                </Button>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded text-[10px] text-amber-400">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>
                  Writing incorrect access bits can permanently lock the sector. Double-check before writing.
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default MifareEditorPanel;
