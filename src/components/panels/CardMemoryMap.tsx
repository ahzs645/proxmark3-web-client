import { useState, useMemo, useCallback, useEffect } from "react";
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
  RefreshCw,
  FileJson,
  FolderOpen,
  Database,
  Search,
  HardDrive,
  Wand2,
  AlertTriangle,
  Save,
  Play,
  Edit3,
  Pencil,
  Check,
  X,
  MoreVertical,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CardType = "classic-1k" | "classic-4k" | "ultralight";

interface Block {
  index: number;
  sector: number;
  data: string;
  kind: "manufacturer" | "data" | "trailer" | "page";
  label: string;
  dirty?: boolean;
}

// PM3 JSON dump format
export interface PM3DumpJson {
  Created?: string;
  FileType?: string;
  Card?: {
    UID?: string;
    ATQA?: string;
    SAK?: string;
  };
  blocks?: Record<string, string>;
  SectorKeys?: Record<string, {
    KeyA?: string;
    KeyB?: string;
    AccessConditions?: string;
    AccessConditionsText?: Record<string, string>;
  }>;
}

export interface CachedDump {
  id: string;
  name: string;
  data: PM3DumpJson;
  cachedAt: number;
}

interface CardMemoryMapProps {
  onCommand: (cmd: string) => void;
  disabled?: boolean;
  cardType?: CardType;
  initialData?: Block[];
  cachedDumps?: CachedDump[];
  onDumpLoad?: (dump: PM3DumpJson, name: string) => void;
  onDumpRename?: (id: string, newName: string) => void;
  onDumpDelete?: (id: string) => void;
  activeDump?: CachedDump | null;
}

// Convert PM3 JSON dump to Block array
const dumpToBlocks = (dump: PM3DumpJson): Block[] => {
  if (!dump.blocks) return generateClassic1KData();

  const blockNumbers = Object.keys(dump.blocks).map(Number).sort((a, b) => a - b);
  const blocks: Block[] = [];

  for (const index of blockNumbers) {
    const sector = Math.floor(index / 4);
    const blockInSector = index % 4;
    const data = dump.blocks[index.toString()] || "00000000000000000000000000000000";

    let kind: Block["kind"] = "data";
    let label = "Data";

    if (index === 0) {
      kind = "manufacturer";
      label = "Manufacturer";
    } else if (blockInSector === 3) {
      kind = "trailer";
      label = "Sector Trailer";
    }

    blocks.push({ index, sector, data, kind, label });
  }

  return blocks;
};

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
  cachedDumps = [],
  onDumpLoad,
  onDumpRename,
  onDumpDelete,
  activeDump,
}: CardMemoryMapProps) {
  const [blocks, setBlocks] = useState<Block[]>(
    initialData || (cardType === "ultralight" ? generateUltralightData() : generateClassic1KData())
  );
  const [selectedBlock, setSelectedBlock] = useState<number | null>(0);
  // Expand all 16 sectors by default
  const [expandedSectors, setExpandedSectors] = useState<Set<number>>(
    new Set(Array.from({ length: 16 }, (_, i) => i))
  );
  const [showKeys, setShowKeys] = useState(true);
  const [showEmptyBlocks, setShowEmptyBlocks] = useState(true);
  const [authKey, setAuthKey] = useState("FFFFFFFFFFFF");
  const [authKeyType, setAuthKeyType] = useState<"A" | "B">("A");
  const [searchFilter, setSearchFilter] = useState("");

  // Trailer builder state
  const [trailerKeyA, setTrailerKeyA] = useState("FFFFFFFFFFFF");
  const [trailerKeyB, setTrailerKeyB] = useState("FFFFFFFFFFFF");
  const [trailerAccess, setTrailerAccess] = useState("FF0780");
  const [trailerGpb, setTrailerGpb] = useState("69");

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showCachePanel, setShowCachePanel] = useState(false);

  // Update blocks when activeDump changes
  useEffect(() => {
    if (activeDump?.data) {
      setBlocks(dumpToBlocks(activeDump.data));
      // Auto-set auth key from dump if available
      const firstSectorKey = activeDump.data.SectorKeys?.["0"];
      if (firstSectorKey?.KeyA && firstSectorKey.KeyA !== "????????????") {
        setAuthKey(firstSectorKey.KeyA);
      }
    }
  }, [activeDump]);

  // Get sector keys from active dump
  const sectorKeys = useMemo(() => {
    return activeDump?.data?.SectorKeys || {};
  }, [activeDump]);

  // Trailer preview
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

  // Handle inline data change with dirty tracking
  const handleDataChange = useCallback((blockIndex: number, value: string) => {
    const sanitized = value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 32);
    setBlocks((prev) =>
      prev.map((b) => (b.index === blockIndex ? { ...b, data: sanitized, dirty: true } : b))
    );
  }, []);

  // Handle JSON file upload
  const handleJsonUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        try {
          const parsed = JSON.parse(text) as PM3DumpJson;
          if (parsed.blocks || parsed.Card) {
            onDumpLoad?.(parsed, file.name);
            break;
          }
        } catch (e) {
          console.error("Failed to parse JSON:", e);
        }
      }
    }
  }, [onDumpLoad]);

  // Group blocks by sector
  const sectors = useMemo(() => {
    const map = new Map<number, Block[]>();
    blocks.forEach((block) => {
      if (!map.has(block.sector)) map.set(block.sector, []);
      map.get(block.sector)!.push(block);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [blocks]);

  // Filtered sectors based on search
  const filteredSectors = useMemo(() => {
    if (!searchFilter) return sectors;
    const filter = searchFilter.toUpperCase();
    return sectors.filter(([_, sectorBlocks]) =>
      sectorBlocks.some(b =>
        b.data.toUpperCase().includes(filter) ||
        hexToAscii(b.data).toUpperCase().includes(filter)
      )
    );
  }, [sectors, searchFilter]);

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

  const copyData = useCallback((data: string) => {
    navigator.clipboard.writeText(data.replace(/\s/g, ""));
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Memory Map Table */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="pb-2 border-b space-y-2">
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
              <label className="cursor-pointer">
                <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                  <span>
                    <FileJson className="h-3 w-3 mr-1" />
                    Load JSON
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => handleJsonUpload(e.target.files)}
                  className="hidden"
                />
              </label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowKeys(!showKeys)}
                className="h-7 text-xs"
              >
                {showKeys ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                Keys
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

          {/* Card Info Bar (shown when dump is loaded) */}
          {activeDump?.data?.Card && (
            <div className="flex flex-wrap items-center gap-3 p-2 bg-gradient-to-r from-primary/10 to-transparent rounded-lg">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">UID:</span>
                <code className="text-sm font-mono font-semibold text-primary">
                  {activeDump.data.Card.UID}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigator.clipboard.writeText(activeDump.data.Card?.UID || "")}
                  className="h-5 w-5 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              {activeDump.data.Card.ATQA && (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">ATQA:</span>
                  <code className="font-mono">{activeDump.data.Card.ATQA}</code>
                </div>
              )}
              {activeDump.data.Card.SAK && (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">SAK:</span>
                  <code className="font-mono">{activeDump.data.Card.SAK}</code>
                </div>
              )}
              <Badge variant="secondary" className="text-[10px] ml-auto">
                {activeDump.name}
              </Badge>
            </div>
          )}

          {/* Search and Cached Dumps Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search blocks..."
                className="h-7 text-xs pl-7"
              />
            </div>
            <Button
              size="sm"
              variant={showCachePanel ? "default" : "outline"}
              onClick={() => setShowCachePanel(!showCachePanel)}
              className="h-7 text-xs gap-1"
            >
              <Database className="h-3 w-3" />
              Cached Cards
              <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1">
                {cachedDumps.length}
              </Badge>
            </Button>
          </div>

          {/* Expanded Cache Panel */}
          {showCachePanel && (
            <div className="border rounded-lg p-3 bg-secondary/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Saved Card Dumps</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowCachePanel(false)}
                  className="h-5 w-5 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              {cachedDumps.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No cached cards yet. Import a JSON dump to get started.
                </p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {cachedDumps.map((dump) => (
                    <div
                      key={dump.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg border transition-colors",
                        activeDump?.id === dump.id
                          ? "bg-primary/10 border-primary/30"
                          : "bg-background hover:bg-secondary/50 border-transparent"
                      )}
                    >
                      {/* Card Icon */}
                      <CreditCard className="h-4 w-4 shrink-0 text-primary" />

                      {/* Name / Rename */}
                      {renamingId === dump.id ? (
                        <div className="flex-1 flex items-center gap-1">
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="h-6 text-xs flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                onDumpRename?.(dump.id, renameValue);
                                setRenamingId(null);
                              }
                              if (e.key === "Escape") {
                                setRenamingId(null);
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              onDumpRename?.(dump.id, renameValue);
                              setRenamingId(null);
                            }}
                            className="h-5 w-5 p-0"
                          >
                            <Check className="h-3 w-3 text-green-500" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRenamingId(null)}
                            className="h-5 w-5 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          {/* Card Info */}
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => onDumpLoad?.(dump.data, dump.name)}
                          >
                            <div className="text-xs font-medium truncate">
                              {dump.name}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              {dump.data.Card?.UID && (
                                <span className="font-mono">{dump.data.Card.UID}</span>
                              )}
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {new Date(dump.cachedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRenamingId(dump.id);
                                setRenameValue(dump.name);
                              }}
                              className="h-6 w-6 p-0"
                              title="Rename"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigator.clipboard.writeText(dump.data.Card?.UID || "")}
                              className="h-6 w-6 p-0"
                              title="Copy UID"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onDumpDelete?.(dump.id)}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardHeader>

        {/* Show welcome screen when no dump is loaded */}
        {!activeDump ? (
          <CardContent className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="max-w-md text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-8 w-8 text-primary" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Import Card Dump</h3>
                <p className="text-sm text-muted-foreground">
                  Load a Proxmark3 card dump to view and edit the memory contents, sector keys, and access conditions.
                </p>
              </div>

              <div className="grid gap-3">
                {/* JSON Dump - Primary option */}
                <label className="cursor-pointer">
                  <div className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <FileJson className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-medium text-sm">PM3 JSON Dump</div>
                      <div className="text-xs text-muted-foreground">
                        hf-mf-*-dump.json files with UID, keys & blocks
                      </div>
                    </div>
                    <Badge variant="default" className="shrink-0">Recommended</Badge>
                  </div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => handleJsonUpload(e.target.files)}
                    className="hidden"
                  />
                </label>

                {/* Folder upload */}
                <label className="cursor-pointer">
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <FolderOpen className="h-4 w-4" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-medium text-sm">Import Folder</div>
                      <div className="text-xs text-muted-foreground">
                        Upload entire "Card Export" folder
                      </div>
                    </div>
                  </div>
                  <input
                    type="file"
                    // @ts-expect-error webkitdirectory is not standard
                    webkitdirectory=""
                    multiple
                    onChange={(e) => {
                      // Find JSON files in the folder
                      const files = e.target.files;
                      if (files) {
                        for (const file of Array.from(files)) {
                          if (file.name.endsWith('.json') && file.name.includes('dump')) {
                            handleJsonUpload(files);
                            break;
                          }
                        }
                      }
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>

                {/* Binary files */}
                <label className="cursor-pointer">
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <HardDrive className="h-4 w-4" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-medium text-sm">Binary Dump</div>
                      <div className="text-xs text-muted-foreground">
                        .bin, .dump, .eml files (no keys)
                      </div>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept=".bin,.dump,.eml"
                    onChange={(e) => handleJsonUpload(e.target.files)}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Cached dumps */}
              {cachedDumps.length > 0 && (
                <div className="pt-4 border-t">
                  <div className="text-xs text-muted-foreground mb-2">Recently loaded:</div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {cachedDumps.slice(0, 5).map((d) => (
                      <Button
                        key={d.id}
                        size="sm"
                        variant="outline"
                        onClick={() => onDumpLoad?.(d.data, d.name)}
                        className="h-7 text-xs"
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        {d.data.Card?.UID?.slice(0, 8) || d.name.slice(0, 12)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground">
                Tip: Use <code className="px-1 py-0.5 bg-secondary rounded">hf mf dump --json</code> to create a JSON dump from your Proxmark3
              </p>
            </div>
          </CardContent>
        ) : (
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
              {filteredSectors.map(([sectorNum, sectorBlocks]) => {
                const keys = sectorKeys[sectorNum.toString()];
                // Count empty data blocks (exclude trailer)
                const emptyCount = sectorBlocks.filter(b =>
                  b.kind === "data" && b.data.replace(/\s/g, "") === "00000000000000000000000000000000"
                ).length;
                const dataBlockCount = sectorBlocks.filter(b => b.kind === "data").length;
                const hasData = emptyCount < dataBlockCount;

                return (
                <>
                  {/* Sector header row */}
                  <tr
                    key={`sector-${sectorNum}`}
                    className={cn(
                      "bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors",
                      !hasData && "opacity-60"
                    )}
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
                        {emptyCount > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-4 bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                          >
                            {emptyCount === dataBlockCount ? "All Empty" : `${emptyCount} empty`}
                          </Badge>
                        )}
                        {showKeys && keys && (
                          <>
                            <div className="flex items-center gap-1 ml-2">
                              <Key className="h-2.5 w-2.5 text-emerald-500" />
                              <code className="text-[10px] font-mono text-emerald-400">
                                {keys.KeyA}
                              </code>
                            </div>
                            <div className="flex items-center gap-1">
                              <Key className="h-2.5 w-2.5 text-blue-500" />
                              <code className="text-[10px] font-mono text-blue-400">
                                {keys.KeyB}
                              </code>
                            </div>
                          </>
                        )}
                        {sectorBlocks.some((b) => b.kind === "trailer") && !showKeys && (
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
                      const isTrailer = block.kind === "trailer";
                      const isManufacturer = block.kind === "manufacturer";
                      // Check if block is empty (all zeros)
                      const isEmpty = block.data.replace(/\s/g, "") === "00000000000000000000000000000000";

                      return (
                        <tr
                          key={block.index}
                          className={cn(
                            "border-b border-border/50 cursor-pointer transition-colors",
                            isSelected
                              ? "bg-primary/10"
                              : "hover:bg-secondary/30",
                            isTrailer && "bg-amber-500/5",
                            isEmpty && !isTrailer && "opacity-50"
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
                            <div className="flex items-center gap-1">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] h-4",
                                  isManufacturer &&
                                    "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                                  isTrailer &&
                                    "bg-amber-500/20 text-amber-400 border-amber-500/30",
                                  block.kind === "data" && !isEmpty &&
                                    "bg-secondary text-secondary-foreground",
                                  isEmpty && !isTrailer &&
                                    "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                                )}
                              >
                                {isEmpty && !isTrailer && !isManufacturer ? "Empty" : block.label}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 font-mono">
                            <Input
                              value={block.data}
                              onChange={(e) => handleDataChange(block.index, e.target.value)}
                              className={cn(
                                "h-7 text-[11px] font-mono tracking-wider",
                                block.dirty && "border-amber-500/50 bg-amber-500/5"
                              )}
                              onClick={(e) => e.stopPropagation()}
                              maxLength={32}
                            />
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
                                title="Read from card"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant={block.dirty ? "default" : "ghost"}
                                className={cn("h-6 w-6 p-0", block.dirty && "bg-amber-500 hover:bg-amber-600")}
                                onClick={() => handleWrite(block.index, block.data)}
                                disabled={disabled || block.data.replace(/\s/g, "").length !== 32}
                                title="Write to card"
                              >
                                <Upload className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => onCommand(`hf mf eget ${block.index}`)}
                                disabled={disabled}
                                title="Get from emulator"
                              >
                                <Play className="h-3 w-3" />
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
              );
              })}
            </tbody>
          </table>
          </div>
        )}
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

              {/* Trailer Builder */}
              {trailerInfo && (
                <div className="space-y-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
                    <Wand2 className="h-3 w-3" />
                    Sector Trailer Builder
                  </div>

                  {/* Current Values */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Key A</span>
                      <span className="font-mono text-amber-400">
                        {showKeys ? trailerInfo.keyA : "????????????"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Key B</span>
                      <span className="font-mono text-amber-400">
                        {showKeys ? trailerInfo.keyB : "????????????"}
                      </span>
                    </div>
                  </div>

                  {/* Builder Inputs */}
                  <div className="space-y-2 pt-2 border-t border-amber-500/20">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">New Key A</label>
                        <Input
                          value={trailerKeyA}
                          onChange={(e) => setTrailerKeyA(e.target.value.toUpperCase().replace(/[^A-F0-9]/gi, ""))}
                          className="h-7 text-xs font-mono"
                          maxLength={12}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">New Key B</label>
                        <Input
                          value={trailerKeyB}
                          onChange={(e) => setTrailerKeyB(e.target.value.toUpperCase().replace(/[^A-F0-9]/gi, ""))}
                          className="h-7 text-xs font-mono"
                          maxLength={12}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">Access Bits</label>
                        <Input
                          value={trailerAccess}
                          onChange={(e) => setTrailerAccess(e.target.value.toUpperCase().replace(/[^A-F0-9]/gi, ""))}
                          className="h-7 text-xs font-mono"
                          maxLength={6}
                          placeholder="FF0780"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">GPB</label>
                        <Input
                          value={trailerGpb}
                          onChange={(e) => setTrailerGpb(e.target.value.toUpperCase().replace(/[^A-F0-9]/gi, ""))}
                          className="h-7 text-xs font-mono"
                          maxLength={2}
                          placeholder="69"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">Preview</span>
                    <div className="flex items-center gap-2 p-2 bg-background/50 rounded border border-amber-500/20">
                      <code className="text-[10px] font-mono flex-1 text-amber-400 break-all">
                        {trailerPreview.match(/.{1,2}/g)?.join(" ")}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyData(trailerPreview)}
                        className="h-5 w-5 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Presets */}
                  <div className="flex flex-wrap gap-1">
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
                        className="h-5 text-[9px] px-1.5"
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>

                  {/* Apply Button */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-xs bg-amber-500 hover:bg-amber-600"
                      onClick={() => {
                        handleDataChange(selectedBlockData.index, trailerPreview);
                      }}
                    >
                      <Edit3 className="h-3 w-3 mr-1" />
                      Apply
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-xs"
                      onClick={() => handleWrite(selectedBlockData.index, trailerPreview)}
                      disabled={disabled}
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Write
                    </Button>
                  </div>

                  {/* Warning */}
                  <div className="flex items-start gap-2 p-2 bg-red-500/10 rounded text-[9px] text-red-400">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>
                      Writing incorrect access bits can permanently lock the sector!
                    </span>
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
