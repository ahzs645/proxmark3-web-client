import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CheckSquare, Eye, RefreshCw, RotateCcw, Upload } from "lucide-react";
import { useTarget } from "@/features/target/context";
import { useCommands } from "@/features/commands/context";
import { DumpCacheBrowser } from "@/features/memory/components/DumpCacheBrowser";
import { BlockInspector } from "@/features/memory/components/BlockInspector";
import { MemoryMapHeader } from "@/features/memory/components/MemoryMapHeader";
import { MagicRestorePipeline } from "@/features/memory/components/MagicRestorePipeline";
import { MemoryTable } from "@/features/memory/components/MemoryTable";
import { MemoryWelcome } from "@/features/memory/components/MemoryWelcome";
import {
  dumpToBlocks,
  generateClassic1KData,
  generateUltralightData,
} from "@/features/memory/lib/dumpAdapters";
import { exportDumpBinary, exportDumpEml, exportDumpJson } from "@/features/memory/lib/export";
import { importDumpFile } from "@/features/memory/lib/import";
import { hexToAscii, parseTrailer } from "@/features/memory/lib/trailer";
import {
  authCandidates,
  buildReadBlockCommand,
  buildWriteBlockCommand,
  parseReadBlockData,
} from "@/features/memory/lib/batch";
import { validateAccessBits } from "@/lib/access-bits";
import { makeOperationId } from "@/features/operations/report";
import { putOperation } from "@/features/vault/operations";
import type { OperationCheckRecord, OperationRecord } from "@/features/vault/db";
import type { LibraryKeyMode } from "@/features/keys/libraryKeyCommands";
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
  libraryKeyMode?: LibraryKeyMode;
  onLibraryKeyModeChange?: (mode: LibraryKeyMode) => void;
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
  libraryKeyMode = "default",
  onLibraryKeyModeChange,
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
  const commands = useCommands();
  const activeRows = Object.values(activeDump?.data.blocks ?? {});
  const activeIsPageDump =
    activeRows.length > 0 && activeRows.every((value) => value.replace(/\s/g, "").length === 8);
  const cardType: CardType =
    cardTypeProp ??
    (activeIsPageDump || target.classification.isUltralight
      ? "ultralight"
      : activeRows.length > 64 || target.classification.size === "4k"
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
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedBlocks, setSelectedBlocks] = useState<Set<number>>(new Set());
  const [failedBlocks, setFailedBlocks] = useState<number[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);
  const [confirmBatchWrite, setConfirmBatchWrite] = useState(false);
  const [pendingDirectBlockWrite, setPendingDirectBlockWrite] = useState<{
    blockIndex: number;
    data: string;
  } | null>(null);

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

  const handleDumpUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setImportError(null);
      for (const file of Array.from(files)) {
        try {
          const imported = await importDumpFile(file);
          onDumpLoad?.(imported.dump, imported.name);
          return;
        } catch (error) {
          setImportError(error instanceof Error ? error.message : `Could not import ${file.name}.`);
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
      if (blockIndex === 0) {
        setPendingDirectBlockWrite({ blockIndex, data: clean });
        return;
      }
      onCommand(`hf mf wrbl ${blockIndex} ${authKeyType.toLowerCase()} ${authKey} ${clean}`);
    },
    [authKey, authKeyType, onCommand],
  );

  const handleDump = useCallback(() => {
    onCommand("hf mf dump");
  }, [onCommand]);

  const handleExportDump = useCallback(
    (format: "json" | "bin" | "eml") => {
      if (!activeDump) return;
      if (format === "bin") exportDumpBinary(activeDump);
      else if (format === "eml") exportDumpEml(activeDump);
      else exportDumpJson(activeDump);
    },
    [activeDump],
  );

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

  const toggleBlockSelection = useCallback((blockIndex: number) => {
    setSelectedBlocks((current) => {
      const next = new Set(current);
      if (next.has(blockIndex)) next.delete(blockIndex);
      else next.add(blockIndex);
      return next;
    });
  }, []);

  const toggleGroupSelection = useCallback((indexes: number[]) => {
    setSelectedBlocks((current) => {
      const next = new Set(current);
      const allSelected = indexes.every((index) => next.has(index));
      for (const index of indexes) {
        if (allSelected) next.delete(index);
        else next.add(index);
      }
      return next;
    });
  }, []);

  const readBlockWithFallback = useCallback(
    async (block: Block): Promise<{ data?: string; output: string[] }> => {
      const output: string[] = [];
      for (const auth of authCandidates(block, sectorKeys, authKeyType, authKey)) {
        const job = await commands.runAndWait(
          buildReadBlockCommand(block.index, auth),
          "mifare-batch-read",
          90_000,
        );
        output.push(...job.outputTail);
        if (job.status === "stopped" || job.resultKind === "failure") continue;
        const data = parseReadBlockData(job.outputTail.join("\n"), block.index);
        if (data) return { data, output };
      }
      return { output };
    },
    [authKey, authKeyType, commands, sectorKeys],
  );

  const persistBatchReport = useCallback(
    async (
      operation: "read" | "write",
      startedAt: number,
      failures: number[],
      output: string[],
      checks: OperationCheckRecord[],
    ) => {
      const endedAt = Date.now();
      const record: OperationRecord = {
        id: makeOperationId(),
        kind: operation,
        command: `mifare batch ${operation}`,
        origin: "memory-map",
        status: failures.length ? "warning" : "succeeded",
        queuedAt: startedAt,
        startedAt,
        endedAt,
        durationMs: endedAt - startedAt,
        targetUid: activeDump?.data.Card?.UID,
        targetType: cardType,
        summary: failures.length
          ? `${operation === "read" ? "Read" : "Write"} completed with failed blocks: ${failures.join(", ")}.`
          : `${operation === "read" ? "Read" : "Write"} completed for ${selectedBlocks.size} selected blocks.`,
        outputTail: output.slice(-200),
        updatedAt: endedAt,
        workflow: "mifare-batch",
        checks,
        verified: operation === "read" ? true : failures.length === 0,
        affectedPages: [...selectedBlocks].sort((a, b) => a - b),
      };
      await putOperation(record);
    },
    [activeDump?.data.Card?.UID, cardType, selectedBlocks],
  );

  const handleReadSelected = useCallback(async () => {
    const chosen = blocks.filter((block) => selectedBlocks.has(block.index));
    if (!chosen.length) return;
    const startedAt = Date.now();
    const failures: number[] = [];
    const output: string[] = [];
    setBatchBusy(true);
    try {
      for (let index = 0; index < chosen.length; index++) {
        const block = chosen[index];
        setBatchStatus(`Reading selected block ${index + 1} of ${chosen.length}…`);
        const result = await readBlockWithFallback(block);
        output.push(...result.output);
        if (!result.data) failures.push(block.index);
        else
          setBlocks((current) =>
            current.map((item) =>
              item.index === block.index ? { ...item, data: result.data!, dirty: false } : item,
            ),
          );
      }
      setFailedBlocks(failures);
      setSelectedBlocks(new Set(failures));
      setBatchStatus(
        failures.length
          ? `Read finished; ${failures.length} block(s) failed and remain selected.`
          : `Read ${chosen.length} selected blocks.`,
      );
      await persistBatchReport("read", startedAt, failures, output, [
        {
          id: "readback",
          label: "Selected block reads",
          state: failures.length ? "warning" : "ok",
          detail: failures.length
            ? `Could not read blocks ${failures.join(", ")} with saved or fallback keys.`
            : "Every selected block returned a complete 16-byte value.",
          blocking: false,
        },
      ]);
    } finally {
      setBatchBusy(false);
    }
  }, [blocks, persistBatchReport, readBlockWithFallback, selectedBlocks]);

  const handleWriteSelected = useCallback(async () => {
    setConfirmBatchWrite(false);
    const chosen = blocks.filter((block) => selectedBlocks.has(block.index));
    if (!chosen.length) return;
    const includesBlock0 = chosen.some((block) => block.index === 0);
    const invalidTrailers = chosen.filter(
      (block) =>
        block.kind === "trailer" &&
        !validateAccessBits(block.data.replace(/\s/g, "").slice(12, 18)),
    );
    if (invalidTrailers.length) {
      setFailedBlocks(invalidTrailers.map((block) => block.index));
      setSelectedBlocks(new Set(invalidTrailers.map((block) => block.index)));
      setBatchStatus(
        `Blocked invalid access bits in trailer block(s): ${invalidTrailers.map((block) => block.index).join(", ")}.`,
      );
      return;
    }
    const startedAt = Date.now();
    const failures: number[] = [];
    const output: string[] = [];
    const checks: OperationCheckRecord[] = [];
    if (includesBlock0) {
      checks.push({
        id: "direct-block0",
        label: "Direct block 0 write",
        state: "warning",
        detail:
          "The optional guarded magic-card workflow was bypassed; this batch used ordinary authenticated block commands without a complete target backup.",
        blocking: false,
      });
    }
    setBatchBusy(true);
    try {
      for (let index = 0; index < chosen.length; index++) {
        const block = chosen[index];
        const expected = block.data.replace(/\s/g, "").toUpperCase();
        let wrote = false;
        setBatchStatus(`Writing selected block ${index + 1} of ${chosen.length}…`);
        for (const auth of authCandidates(block, sectorKeys, authKeyType, authKey)) {
          const job = await commands.runAndWait(
            buildWriteBlockCommand(block.index, expected, auth),
            "mifare-batch-write",
            90_000,
          );
          output.push(...job.outputTail);
          if (job.status !== "stopped" && job.resultKind !== "failure") {
            wrote = true;
            break;
          }
        }
        if (wrote && block.kind !== "trailer") {
          const readback = await readBlockWithFallback(block);
          output.push(...readback.output);
          wrote = readback.data === expected;
        }
        if (!wrote) failures.push(block.index);
        else
          setBlocks((current) =>
            current.map((item) => (item.index === block.index ? { ...item, dirty: false } : item)),
          );
      }
      checks.push({
        id: "verify",
        label: "Per-block verification",
        state: failures.length ? "warning" : "ok",
        detail: failures.length
          ? `Write or readback failed for blocks ${failures.join(", ")}.`
          : "Every ordinary data block matched exact readback; trailer blocks returned a successful PM3 acknowledgement.",
        blocking: false,
      });
      setFailedBlocks(failures);
      setSelectedBlocks(new Set(failures));
      setBatchStatus(
        failures.length
          ? `Write finished; ${failures.length} failed block(s) remain selected for retry.`
          : `Wrote ${chosen.length} selected blocks.`,
      );
      await persistBatchReport("write", startedAt, failures, output, checks);
    } finally {
      setBatchBusy(false);
    }
  }, [
    authKey,
    authKeyType,
    blocks,
    commands,
    persistBatchReport,
    readBlockWithFallback,
    sectorKeys,
    selectedBlocks,
  ]);

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
            onDumpUpload={handleDumpUpload}
            onSearchFilterChange={setSearchFilter}
            onToggleCachePanel={() => setShowCachePanel((prev) => !prev)}
            onToggleShowKeys={() => setShowKeys((prev) => !prev)}
            onExportDump={handleExportDump}
            onDump={handleDump}
            onAutopwn={handleAutopwn}
            libraryKeyMode={libraryKeyMode}
            matchingKeyCount={target.savedKeyCount}
            libraryKeyCount={target.libraryKeyCount}
            onLibraryKeyModeChange={onLibraryKeyModeChange}
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
          {importError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {importError}
            </div>
          ) : null}
        </CardHeader>

        {!activeDump ? (
          <MemoryWelcome
            cachedDumps={cachedDumps}
            onDumpLoad={onDumpLoad}
            onDumpUpload={handleDumpUpload}
          />
        ) : (
          <CardContent className="flex-1 overflow-auto p-0">
            <MagicRestorePipeline activeDump={activeDump} disabled={disabled} />
            {cardType !== "ultralight" ? (
              <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
                <Badge variant="secondary">
                  <CheckSquare className="mr-1 h-3 w-3" />
                  {selectedBlocks.size} selected
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleReadSelected()}
                  disabled={disabled || batchBusy || selectedBlocks.size === 0}
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Read selected
                </Button>
                <Button
                  size="sm"
                  onClick={() => setConfirmBatchWrite(true)}
                  disabled={disabled || batchBusy || selectedBlocks.size === 0}
                >
                  <Upload className="mr-1 h-3 w-3" />
                  Write selected
                </Button>
                {failedBlocks.length ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedBlocks(new Set(failedBlocks))}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Select {failedBlocks.length} failed
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedBlocks(new Set())}
                  disabled={!selectedBlocks.size}
                >
                  Clear selection
                </Button>
                {batchStatus ? (
                  <span className="ml-auto text-xs text-muted-foreground">{batchStatus}</span>
                ) : null}
              </div>
            ) : null}
            <MemoryTable
              filteredSectors={filteredSectors}
              sectorKeys={sectorKeys}
              expandedSectors={expandedSectors}
              selectedBlock={selectedBlock}
              selectedBlocks={selectedBlocks}
              showKeys={showKeys}
              disabled={disabled}
              selectionEnabled={cardType !== "ultralight"}
              onToggleSector={toggleSector}
              onSelectBlock={setSelectedBlock}
              onToggleBlockSelection={toggleBlockSelection}
              onToggleSectorSelection={toggleGroupSelection}
              onToggleAllSelection={toggleGroupSelection}
              onDataChange={handleDataChange}
              onReadBlock={handleRead}
              onWriteBlock={handleWrite}
              onEmulatorGet={(blockIndex) => onCommand(`hf mf eget ${blockIndex}`)}
              onCopyData={handleCopyData}
            />
          </CardContent>
        )}
      </Card>
      <ConfirmDialog
        open={confirmBatchWrite}
        title={`Write ${selectedBlocks.size} selected block${selectedBlocks.size === 1 ? "" : "s"}?`}
        description={
          selectedBlocks.has(0)
            ? "This direct batch includes block 0. It bypasses the optional guarded magic-card workflow and uses ordinary authenticated block writes, so it may fail on cards requiring generation-specific commands and does not create a complete target backup."
            : "This writes the selected data/trailer blocks with the supplied or saved keys. It validates trailer access bits and reads ordinary blocks back, but it does not create a complete target-card backup."
        }
        confirmLabel="Write selected"
        destructive
        onConfirm={() => void handleWriteSelected()}
        onClose={() => setConfirmBatchWrite(false)}
      />
      <ConfirmDialog
        open={pendingDirectBlockWrite !== null}
        title="Write block 0 directly?"
        description="This bypasses the optional guarded magic-card workflow and sends an ordinary authenticated block write. It may not work on a magic card that requires a generation-specific command, and no complete target backup will be created."
        confirmLabel="Direct write"
        destructive
        onConfirm={() => {
          if (pendingDirectBlockWrite) {
            onCommand(
              `hf mf wrbl ${pendingDirectBlockWrite.blockIndex} ${authKeyType.toLowerCase()} ${authKey} ${pendingDirectBlockWrite.data}`,
            );
            setBatchStatus("Sent a direct block 0 write without the optional guarded workflow.");
          }
          setPendingDirectBlockWrite(null);
        }}
        onClose={() => setPendingDirectBlockWrite(null)}
      />

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
