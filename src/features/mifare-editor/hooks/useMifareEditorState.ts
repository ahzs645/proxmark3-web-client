import { useCallback, useMemo, useState } from "react";
import type { CachedAsset } from "@/components/panels/KeyCachePanel";
import type { BlockRow, KeyType, TrailerPreset } from "../types";
import {
  DEMO_ROWS,
  TRAILER_PRESETS,
  buildReadBlockCommand,
  buildTrailerPreview,
  buildWriteBlockCommand,
  copyToClipboard,
  resolveCachePath,
  sanitizeBlockData,
  sanitizeBlockNumber,
  sanitizeHex,
} from "../lib/editorUtils";

interface UseMifareEditorStateOptions {
  onCommand: (cmd: string) => void;
  cacheItems: CachedAsset[];
  cachePathPrefix: string;
}

export function useMifareEditorState({
  onCommand,
  cacheItems,
  cachePathPrefix,
}: UseMifareEditorStateOptions) {
  const [rows, setRows] = useState<BlockRow[]>(DEMO_ROWS);
  const [keyValue, setKeyValue] = useState("FFFFFFFFFFFF");
  const [keyType, setKeyType] = useState<KeyType>("A");
  const [targetBlock, setTargetBlock] = useState("0");
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [showTrailerBuilder, setShowTrailerBuilder] = useState(false);
  const [trailerBlock, setTrailerBlock] = useState("3");
  const [trailerKeyA, setTrailerKeyA] = useState("FFFFFFFFFFFF");
  const [trailerKeyB, setTrailerKeyB] = useState("FFFFFFFFFFFF");
  const [trailerAccess, setTrailerAccess] = useState("FF0780");
  const [trailerGpb, setTrailerGpb] = useState("69");

  const dumpChoices = useMemo(
    () => cacheItems.filter((item) => item.kind === "dump"),
    [cacheItems],
  );
  const keyChoices = useMemo(() => cacheItems.filter((item) => item.kind === "keys"), [cacheItems]);
  const trailerPresets = useMemo<TrailerPreset[]>(() => TRAILER_PRESETS, []);

  const handleDataChange = useCallback((block: number, value: string) => {
    const sanitized = sanitizeBlockData(value);
    setRows((prev) =>
      prev.map((row) => (row.block === block ? { ...row, data: sanitized, dirty: true } : row)),
    );
  }, []);

  const readBlock = useCallback(
    (block: number) => {
      onCommand(buildReadBlockCommand(block, keyType, keyValue));
    },
    [keyType, keyValue, onCommand],
  );

  const writeBlock = useCallback(
    (block: number, data: string) => {
      if (data.length !== 32) return;
      onCommand(buildWriteBlockCommand(block, keyType, keyValue, data));
    },
    [keyType, keyValue, onCommand],
  );

  const loadDump = useCallback(
    (item: CachedAsset) => {
      onCommand(`hf mf eload -f ${resolveCachePath(item, cachePathPrefix)}`);
    },
    [cachePathPrefix, onCommand],
  );

  const loadKeys = useCallback(
    (item: CachedAsset) => {
      onCommand(`mem load -f ${resolveCachePath(item, cachePathPrefix)} --mfc`);
    },
    [cachePathPrefix, onCommand],
  );

  const trailerPreview = useMemo(
    () => buildTrailerPreview(trailerKeyA, trailerKeyB, trailerAccess, trailerGpb),
    [trailerAccess, trailerGpb, trailerKeyA, trailerKeyB],
  );

  const applyTrailerPreset = useCallback((preset: TrailerPreset) => {
    setTrailerKeyA(preset.keyA);
    setTrailerKeyB(preset.keyB);
    setTrailerAccess(preset.access);
    setTrailerGpb(preset.gpb);
  }, []);

  const writeTrailer = useCallback(() => {
    const block = Number.parseInt(trailerBlock, 10);
    if (Number.isNaN(block)) return;
    onCommand(buildWriteBlockCommand(block, keyType, keyValue, trailerPreview));
  }, [keyType, keyValue, onCommand, trailerBlock, trailerPreview]);

  const readTrailer = useCallback(() => {
    const block = Number.parseInt(trailerBlock, 10);
    if (Number.isNaN(block)) return;
    onCommand(buildReadBlockCommand(block, keyType, keyValue));
  }, [keyType, keyValue, onCommand, trailerBlock]);

  return {
    rows,
    keyValue,
    keyType,
    targetBlock,
    selectedRow,
    showTrailerBuilder,
    trailerBlock,
    trailerKeyA,
    trailerKeyB,
    trailerAccess,
    trailerGpb,
    dumpChoices,
    keyChoices,
    trailerPresets,
    trailerPreview,
    setKeyValue: (value: string) => setKeyValue(sanitizeHex(value, 12)),
    setKeyType,
    setTargetBlock: (value: string) => setTargetBlock(sanitizeBlockNumber(value)),
    setSelectedRow,
    setShowTrailerBuilder,
    setTrailerBlock,
    setTrailerKeyA: (value: string) => setTrailerKeyA(sanitizeHex(value, 12)),
    setTrailerKeyB: (value: string) => setTrailerKeyB(sanitizeHex(value, 12)),
    setTrailerAccess: (value: string) => setTrailerAccess(sanitizeHex(value, 6)),
    setTrailerGpb: (value: string) => setTrailerGpb(sanitizeHex(value, 2)),
    handleDataChange,
    readBlock,
    writeBlock,
    loadDump,
    loadKeys,
    writeTrailer,
    readTrailer,
    applyTrailerPreset,
    copyToClipboard,
  };
}
