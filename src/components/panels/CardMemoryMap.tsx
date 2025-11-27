import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CreditCard,
  Key,
  Download,
  Upload,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CardType = "classic-1k" | "classic-4k" | "ultralight";

interface Block {
  index: number;
  sector: number;
  data: string;
  kind: "manufacturer" | "data" | "trailer" | "page";
  label: string;
}

interface CardMemoryMapProps {
  onCommand: (cmd: string) => void;
  disabled?: boolean;
  cardType?: CardType;
  initialData?: Block[];
}

// Demo data for Mifare Classic 1K
const generateClassic1KData = (): Block[] => {
  const blocks: Block[] = [];
  for (let sector = 0; sector < 16; sector++) {
    for (let block = 0; block < 4; block++) {
      const index = sector * 4 + block;
      let kind: Block["kind"] = "data";
      let label = "Data";
      let data = "00000000000000000000000000000000";

      if (index === 0) {
        kind = "manufacturer";
        label = "Manufacturer";
        data = "3DD6CCC2E5088400E2934603127660D9";
      } else if (block === 3) {
        kind = "trailer";
        label = "Sector Trailer";
        data = "FFFFFFFFFFFF FF078069 FFFFFFFFFFFF";
      }

      blocks.push({ index, sector, data, kind, label });
    }
  }
  return blocks;
};

const generateUltralightData = (): Block[] => {
  return Array.from({ length: 16 }, (_, i) => ({
    index: i,
    sector: 0,
    data: i < 2 ? "048FC929200000" + (i === 0 ? "09" : "48") : "00000000",
    kind: (i < 2 ? "manufacturer" : i === 2 ? "trailer" : "data") as Block["kind"],
    label: i < 2 ? "UID/BCC" : i === 2 ? "Lock/OTP" : "User Data",
  }));
};

function parseTrailer(data: string) {
  const clean = data.replace(/\s/g, "");
  if (clean.length < 32) return null;
  return {
    keyA: clean.slice(0, 12),
    accessBits: clean.slice(12, 20),
    keyB: clean.slice(20, 32),
  };
}

function renderHexByte(byte: string, highlight?: "key" | "access" | "data" | "uid") {
  const colorMap = {
    key: "text-amber-400",
    access: "text-purple-400",
    data: "text-foreground",
    uid: "text-emerald-400",
  };
  return (
    <span className={cn("font-mono", colorMap[highlight || "data"])}>
      {byte}
    </span>
  );
}

function hexToAscii(hex: string): string {
  const clean = hex.replace(/\s/g, "");
  let result = "";
  for (let i = 0; i < clean.length; i += 2) {
    const byte = parseInt(clean.slice(i, i + 2), 16);
    result += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".";
  }
  return result;
}

export function CardMemoryMap({
  onCommand,
  disabled = false,
  cardType = "classic-1k",
  initialData,
}: CardMemoryMapProps) {
  const [blocks, setBlocks] = useState<Block[]>(
    initialData || (cardType === "ultralight" ? generateUltralightData() : generateClassic1KData())
  );
  const [selectedBlock, setSelectedBlock] = useState<number | null>(0);
  const [expandedSectors, setExpandedSectors] = useState<Set<number>>(new Set([0, 1]));
  const [showKeys, setShowKeys] = useState(false);
  const [editingBlock, setEditingBlock] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [authKey, setAuthKey] = useState("FFFFFFFFFFFF");
  const [authKeyType, setAuthKeyType] = useState<"A" | "B">("A");

  // Group blocks by sector
  const sectors = useMemo(() => {
    const map = new Map<number, Block[]>();
    blocks.forEach((block) => {
      if (!map.has(block.sector)) map.set(block.sector, []);
      map.get(block.sector)!.push(block);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [blocks]);

  const selectedBlockData = useMemo(
    () => blocks.find((b) => b.index === selectedBlock) || null,
    [blocks, selectedBlock]
  );

  const trailerInfo = useMemo(() => {
    if (!selectedBlockData || selectedBlockData.kind !== "trailer") return null;
    return parseTrailer(selectedBlockData.data);
  }, [selectedBlockData]);

  const toggleSector = useCallback((sector: number) => {
    setExpandedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  }, []);

  const handleRead = useCallback(
    (blockIndex: number) => {
      const cmd = `hf mf rdbl ${blockIndex} ${authKeyType.toLowerCase()} ${authKey}`;
      onCommand(cmd);
    },
    [onCommand, authKey, authKeyType]
  );

  const handleWrite = useCallback(
    (blockIndex: number, data: string) => {
      if (data.replace(/\s/g, "").length !== 32) return;
      const cmd = `hf mf wrbl ${blockIndex} ${authKeyType.toLowerCase()} ${authKey} ${data.replace(/\s/g, "")}`;
      onCommand(cmd);
    },
    [onCommand, authKey, authKeyType]
  );

  const handleDump = useCallback(() => {
    onCommand("hf mf dump");
  }, [onCommand]);

  const handleAutopwn = useCallback(() => {
    onCommand(cardType === "classic-4k" ? "hf mf autopwn --4k" : "hf mf autopwn --1k");
  }, [onCommand, cardType]);

  const startEditing = useCallback((block: Block) => {
    setEditingBlock(block.index);
    setEditValue(block.data.replace(/\s/g, ""));
  }, []);

  const saveEdit = useCallback(() => {
    if (editingBlock === null) return;
    setBlocks((prev) =>
      prev.map((b) =>
        b.index === editingBlock ? { ...b, data: editValue.toUpperCase() } : b
      )
    );
    setEditingBlock(null);
    setEditValue("");
  }, [editingBlock, editValue]);

  const copyData = useCallback((data: string) => {
    navigator.clipboard.writeText(data.replace(/\s/g, ""));
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Memory Map Table */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Memory Map
              <Badge variant="outline" className="ml-2">
                {cardType === "classic-1k"
                  ? "MIFARE Classic 1K"
                  : cardType === "classic-4k"
                  ? "MIFARE Classic 4K"
                  : "MIFARE Ultralight"}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowKeys(!showKeys)}
                className="h-7 text-xs"
              >
                {showKeys ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                {showKeys ? "Hide Keys" : "Show Keys"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDump}
                disabled={disabled}
                className="h-7 text-xs"
              >
                <Download className="h-3 w-3 mr-1" />
                Dump
              </Button>
              <Button
                size="sm"
                onClick={handleAutopwn}
                disabled={disabled}
                className="h-7 text-xs"
              >
                <Key className="h-3 w-3 mr-1" />
                Autopwn
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-secondary/50 sticky top-0">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium w-16">Sec</th>
                <th className="px-3 py-2 text-left font-medium w-16">Blk</th>
                <th className="px-3 py-2 text-left font-medium w-20">Type</th>
                <th className="px-3 py-2 text-left font-medium">Data (Hex)</th>
                <th className="px-3 py-2 text-left font-medium w-36">ASCII</th>
                <th className="px-3 py-2 text-right font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sectors.map(([sectorNum, sectorBlocks]) => (
                <>
                  {/* Sector header row */}
                  <tr
                    key={`sector-${sectorNum}`}
                    className="bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors"
                    onClick={() => toggleSector(sectorNum)}
                  >
                    <td colSpan={6} className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        {expandedSectors.has(sectorNum) ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        <span className="font-medium">Sector {sectorNum}</span>
                        <Badge variant="outline" className="text-[10px] h-4">
                          {sectorBlocks.length} blocks
                        </Badge>
                        {sectorBlocks.some((b) => b.kind === "trailer") && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-4 bg-amber-500/20 text-amber-400 border-amber-500/30"
                          >
                            <Lock className="h-2.5 w-2.5 mr-0.5" />
                            Protected
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Block rows */}
                  {expandedSectors.has(sectorNum) &&
                    sectorBlocks.map((block) => {
                      const isSelected = selectedBlock === block.index;
                      const isEditing = editingBlock === block.index;
                      const isTrailer = block.kind === "trailer";
                      const displayData = isTrailer && !showKeys
                        ? block.data.replace(/[A-Fa-f0-9]{12}/g, (m, offset) =>
                            offset < 12 || offset >= 20 ? "????????????" : m
                          )
                        : block.data;

                      return (
                        <tr
                          key={block.index}
                          className={cn(
                            "border-b border-border/50 cursor-pointer transition-colors",
                            isSelected
                              ? "bg-primary/10"
                              : "hover:bg-secondary/30",
                            isTrailer && "bg-amber-500/5"
                          )}
                          onClick={() => setSelectedBlock(block.index)}
                        >
                          <td className="px-3 py-1.5 text-muted-foreground font-mono">
                            {block.sector}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground font-mono">
                            {block.index}
                          </td>
                          <td className="px-3 py-1.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] h-4",
                                block.kind === "manufacturer" &&
                                  "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                                block.kind === "trailer" &&
                                  "bg-amber-500/20 text-amber-400 border-amber-500/30",
                                block.kind === "data" &&
                                  "bg-secondary text-secondary-foreground"
                              )}
                            >
                              {block.label}
                            </Badge>
                          </td>
                          <td className="px-3 py-1.5 font-mono">
                            {isEditing ? (
                              <Input
                                value={editValue}
                                onChange={(e) =>
                                  setEditValue(e.target.value.toUpperCase().replace(/[^A-F0-9]/gi, ""))
                                }
                                className="h-6 text-xs font-mono w-full"
                                maxLength={32}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit();
                                  if (e.key === "Escape") {
                                    setEditingBlock(null);
                                    setEditValue("");
                                  }
                                }}
                                autoFocus
                              />
                            ) : (
                              <span className="text-[11px] tracking-wider">
                                {displayData.match(/.{1,2}/g)?.join(" ") || displayData}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-muted-foreground text-[11px]">
                            {hexToAscii(block.data)}
                          </td>
                          <td className="px-3 py-1.5">
                            <div
                              className="flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => handleRead(block.index)}
                                disabled={disabled}
                                title="Read"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() =>
                                  isEditing ? saveEdit() : startEditing(block)
                                }
                                title={isEditing ? "Save" : "Edit"}
                              >
                                {isEditing ? (
                                  <Upload className="h-3 w-3" />
                                ) : (
                                  <Key className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => copyData(block.data)}
                                title="Copy"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Block Inspector */}
      <Card className="w-full lg:w-80 flex flex-col">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            Block Inspector
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 space-y-4 pt-4">
          {selectedBlockData ? (
            <>
              {/* Block Info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Block</span>
                  <span className="font-mono">{selectedBlockData.index}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Sector</span>
                  <span className="font-mono">{selectedBlockData.sector}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Type</span>
                  <Badge variant="outline" className="text-[10px]">
                    {selectedBlockData.label}
                  </Badge>
                </div>
              </div>

              {/* Hex View */}
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Hex Data</span>
                <div className="p-2 bg-secondary/50 rounded border font-mono text-[11px] break-all">
                  {selectedBlockData.data.replace(/\s/g, "").match(/.{1,2}/g)?.join(" ")}
                </div>
              </div>

              {/* ASCII View */}
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">ASCII</span>
                <div className="p-2 bg-secondary/50 rounded border font-mono text-[11px]">
                  {hexToAscii(selectedBlockData.data)}
                </div>
              </div>

              {/* Trailer Breakdown */}
              {trailerInfo && (
                <div className="space-y-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
                    <Key className="h-3 w-3" />
                    Sector Trailer
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Key A</span>
                      <span className="font-mono text-amber-400">
                        {showKeys ? trailerInfo.keyA : "????????????"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Access Bits</span>
                      <span className="font-mono text-purple-400">
                        {trailerInfo.accessBits}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Key B</span>
                      <span className="font-mono text-amber-400">
                        {showKeys ? trailerInfo.keyB : "????????????"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Authentication */}
              <div className="space-y-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground">Authentication</span>
                <div className="flex gap-2">
                  <Input
                    value={authKey}
                    onChange={(e) => setAuthKey(e.target.value.toUpperCase())}
                    placeholder="Key (12 hex)"
                    className="h-8 text-xs font-mono flex-1"
                    maxLength={12}
                  />
                  <Button
                    size="sm"
                    variant={authKeyType === "A" ? "default" : "outline"}
                    className="h-8 w-10 text-xs"
                    onClick={() => setAuthKeyType("A")}
                  >
                    A
                  </Button>
                  <Button
                    size="sm"
                    variant={authKeyType === "B" ? "default" : "outline"}
                    className="h-8 w-10 text-xs"
                    onClick={() => setAuthKeyType("B")}
                  >
                    B
                  </Button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => handleRead(selectedBlockData.index)}
                  disabled={disabled}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Read
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 h-8 text-xs"
                  onClick={() => handleWrite(selectedBlockData.index, selectedBlockData.data)}
                  disabled={disabled}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Write
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    setBlocks((prev) =>
                      prev.map((b) =>
                        b.index === selectedBlockData.index
                          ? { ...b, data: "00000000000000000000000000000000" }
                          : b
                      )
                    );
                  }}
                  title="Zero block"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground text-sm py-8">
              <CreditCard className="h-8 w-8 mb-2 opacity-50" />
              <p>Select a block to inspect</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CardMemoryMap;
