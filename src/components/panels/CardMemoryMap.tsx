import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye } from "lucide-react";
import { useTarget } from "@/features/target/context";
import { DumpCacheBrowser } from "@/features/memory/components/DumpCacheBrowser";
import { BlockInspector } from "@/features/memory/components/BlockInspector";
import { MemoryMapHeader } from "@/features/memory/components/MemoryMapHeader";
import { MemoryTable } from "@/features/memory/components/MemoryTable";
import { MemoryWelcome } from "@/features/memory/components/MemoryWelcome";
import {
  dumpToBlocks,
  generateClassic1KData,
  generateUltralightData,
} from "@/features/memory/lib/dumpAdapters";
import { exportDumpJson } from "@/features/memory/lib/export";
import { hexToAscii, parseTrailer } from "@/features/memory/lib/trailer";
import type {
  Block,
  CachedDump,
  CardType,
  PM3DumpJson,
  SectorGroup,
  SectorKeysRecord,
} from "@/features/memory/types";

export type { Block, CachedDump, CardType, PM3DumpJson } from "@/features/memory/types";

interface CardMemoryMapProps {
  onCommand: (cmd: string) => void;
  onDumpWithSavedKeys?: (uid: string, cardType: "1k" | "4k") => void;
  disabled?: boolean;
  cardType?: CardType;
  initialData?: Block[];
  cachedDumps?: CachedDump[];
  onDumpLoad?: (dump: PM3DumpJson, name: string) => void;
  onDumpRename?: (id: string, newName: string) => void;
  onDumpDelete?: (id: string) => void;
  activeDump?: CachedDump | null;
}

export function CardMemoryMap({
  onCommand,
  onDumpWithSavedKeys,
  disabled = false,
  cardType: cardTypeProp,
  initialData,
  cachedDumps = [],
  onDumpLoad,
  onDumpRename,
  onDumpDelete,
  activeDump,
}: CardMemoryMapProps) {
  // Fall back to the active target's detected type so labels and the Autopwn
  // size flag match the scanned card instead of always assuming Classic 1K.
  const { target } = useTarget();
  const cardType: CardType =
    cardTypeProp ??
    (target.classification.isUltralight
      ? "ultralight"
      : target.classification.size === "4k"
        ? "classic-4k"
        : "classic-1k");

  const [blocks, setBlocks] = useState<Block[]>(
    initialData || (cardType === "ultralight" ? generateUltralightData() : generateClassic1KData()),
  );
  const [selectedBlock, setSelectedBlock] = useState<number | null>(0);
  const [expandedSectors, setExpandedSectors] = useState<Set<number>>(
    new Set(Array.from({ length: 16 }, (_, i) => i)),
  );
  const [showKeys, setShowKeys] = useState(true);
  const [authKey, setAuthKey] = useState("FFFFFFFFFFFF");
  const [authKeyType, setAuthKeyType] = useState<"A" | "B">("A");
  const [searchFilter, setSearchFilter] = useState("");
  const [showCachePanel, setShowCachePanel] = useState(false);

  useEffect(() => {
    if (activeDump?.data) {
      setBlocks(dumpToBlocks(activeDump.data));
      const firstSectorKey = activeDump.data.SectorKeys?.["0"];
      if (firstSectorKey?.KeyA && firstSectorKey.KeyA !== "????????????") {
        setAuthKey(firstSectorKey.KeyA);
      }
    }
  }, [activeDump]);

  const sectorKeys = useMemo<SectorKeysRecord>(
    () => activeDump?.data?.SectorKeys || {},
    [activeDump],
  );

  const handleDataChange = useCallback((blockIndex: number, value: string) => {
    const sanitized = value
      .toUpperCase()
      .replace(/[^A-F0-9]/gi, "")
      .slice(0, 32);
    setBlocks((prev) =>
      prev.map((block) =>
        block.index === blockIndex ? { ...block, data: sanitized, dirty: true } : block,
      ),
    );
  }, []);

  const handleJsonUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      for (const file of Array.from(files)) {
        if (!file.name.endsWith(".json")) continue;

        const text = await file.text();
        try {
          const parsed = JSON.parse(text) as PM3DumpJson;
          if (parsed.blocks || parsed.Card) {
            onDumpLoad?.(parsed, file.name);
            break;
          }
        } catch (error) {
          console.error("Failed to parse JSON:", error);
        }
      }
    },
    [onDumpLoad],
  );

  const sectors = useMemo<SectorGroup[]>(() => {
    const grouped = new Map<number, Block[]>();

    blocks.forEach((block) => {
      if (!grouped.has(block.sector)) grouped.set(block.sector, []);
      grouped.get(block.sector)!.push(block);
    });

    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [blocks]);

  const filteredSectors = useMemo(() => {
    if (!searchFilter) return sectors;
    const filter = searchFilter.toUpperCase();

    return sectors.filter(([, sectorBlocks]) =>
      sectorBlocks.some(
        (block) =>
          block.data.toUpperCase().includes(filter) ||
          hexToAscii(block.data).toUpperCase().includes(filter),
      ),
    );
  }, [searchFilter, sectors]);

  const selectedBlockData = useMemo(
    () => blocks.find((block) => block.index === selectedBlock) || null,
    [blocks, selectedBlock],
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
      onCommand(`hf mf rdbl ${blockIndex} ${authKeyType.toLowerCase()} ${authKey}`);
    },
    [authKey, authKeyType, onCommand],
  );

  const handleWrite = useCallback(
    (blockIndex: number, data: string) => {
      const clean = data.replace(/\s/g, "");
      if (clean.length !== 32) return;
      onCommand(`hf mf wrbl ${blockIndex} ${authKeyType.toLowerCase()} ${authKey} ${clean}`);
    },
    [authKey, authKeyType, onCommand],
  );

  const handleDump = useCallback(() => {
    onCommand("hf mf dump");
  }, [onCommand]);

  const handleExportDump = useCallback(() => {
    if (!activeDump) return;
    exportDumpJson(activeDump);
  }, [activeDump]);

  const handleAutopwn = useCallback(() => {
    onCommand(cardType === "classic-4k" ? "hf mf autopwn --4k" : "hf mf autopwn --1k");
  }, [cardType, onCommand]);

  const handleDumpWithSavedKeys = useCallback(() => {
    const uid = activeDump?.data?.Card?.UID || "";
    onDumpWithSavedKeys?.(uid, cardType === "classic-4k" ? "4k" : "1k");
  }, [activeDump, cardType, onDumpWithSavedKeys]);

  const handleCopyData = useCallback((data: string) => {
    void navigator.clipboard.writeText(data.replace(/\s/g, ""));
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 lg:flex-row">
      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardHeader className="space-y-2 border-b pb-2">
          <MemoryMapHeader
            cardType={cardType}
            showKeys={showKeys}
            disabled={disabled}
            activeDump={activeDump}
            searchFilter={searchFilter}
            showCachePanel={showCachePanel}
            cachedDumpCount={cachedDumps.length}
            onJsonUpload={handleJsonUpload}
            onSearchFilterChange={setSearchFilter}
            onToggleCachePanel={() => setShowCachePanel((prev) => !prev)}
            onToggleShowKeys={() => setShowKeys((prev) => !prev)}
            onExportDump={handleExportDump}
            onDump={handleDump}
            onAutopwn={handleAutopwn}
            onDumpWithSavedKeys={onDumpWithSavedKeys ? handleDumpWithSavedKeys : undefined}
          />

          {showCachePanel ? (
            <DumpCacheBrowser
              cachedDumps={cachedDumps}
              activeDump={activeDump}
              onClose={() => setShowCachePanel(false)}
              onDumpLoad={onDumpLoad}
              onDumpRename={onDumpRename}
              onDumpDelete={onDumpDelete}
            />
          ) : null}
        </CardHeader>

        {!activeDump ? (
          <MemoryWelcome
            cachedDumps={cachedDumps}
            onDumpLoad={onDumpLoad}
            onJsonUpload={handleJsonUpload}
          />
        ) : (
          <CardContent className="flex-1 overflow-auto p-0">
            <MemoryTable
              filteredSectors={filteredSectors}
              sectorKeys={sectorKeys}
              expandedSectors={expandedSectors}
              selectedBlock={selectedBlock}
              showKeys={showKeys}
              disabled={disabled}
              onToggleSector={toggleSector}
              onSelectBlock={setSelectedBlock}
              onDataChange={handleDataChange}
              onReadBlock={handleRead}
              onWriteBlock={handleWrite}
              onEmulatorGet={(blockIndex) => onCommand(`hf mf eget ${blockIndex}`)}
              onCopyData={handleCopyData}
            />
          </CardContent>
        )}
      </Card>

      <Card className="flex w-full flex-col lg:w-80">
        <CardHeader className="border-b pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Eye className="h-4 w-4 text-primary" />
            Block Inspector
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 space-y-4 pt-4">
          <BlockInspector
            selectedBlockData={selectedBlockData}
            trailerInfo={trailerInfo}
            showKeys={showKeys}
            authKey={authKey}
            authKeyType={authKeyType}
            disabled={disabled}
            onAuthKeyChange={setAuthKey}
            onAuthKeyTypeChange={setAuthKeyType}
            onReadBlock={handleRead}
            onWriteBlock={handleWrite}
            onDataChange={handleDataChange}
            onCopyData={handleCopyData}
            onZeroBlock={(blockIndex) =>
              setBlocks((prev) =>
                prev.map((block) =>
                  block.index === blockIndex
                    ? { ...block, data: "00000000000000000000000000000000" }
                    : block,
                ),
              )
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default CardMemoryMap;
