import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import { RibbonToolbar } from "@/components/ribbon/RibbonToolbar";
import type { TerminalHandle } from "@/components/terminal/Terminal";
import { useProxmarkWasm } from "@/hooks/useProxmarkWasm";
import { useTheme } from "@/hooks/useTheme";
import { type CachedAsset, type CachedAssetKind } from "@/components/panels/KeyCachePanel";
import type { PM3DumpJson } from "@/components/panels/CardMemoryMap";
import { getTransportLabel, type TransportType } from "@/lib/transports";
import pm3WebUSB from "@/lib/pm3WebUSB";
import { useCommandHistory } from "@/features/workbench/hooks/useCommandHistory";
import { useDumpStore } from "@/features/workbench/hooks/useDumpStore";
import { MainPanelRouter } from "@/features/workbench/components/MainPanelRouter";
import { type CachedAssetWithData, type EmscriptenFSLike } from "@/features/workbench/types";
import {
  importDumpKeysToLibrary,
  buildKeyDictionary,
  loadStoredState,
  KEYS_STORAGE_KEY,
} from "@/components/panels/library/utils";
import type { StoredKey } from "@/components/panels/library/types";
import { RIBBON_TABS } from "@/features/ribbon/config";
import { PRIMARY_SAMPLE_DUMP } from "@/features/memory/demo/sampleDumps";
import { tagInfoFromDump } from "@/features/tag-info/fromDump";
import { useCardTarget } from "@/features/target/useCardTarget";
import { CardTargetContext } from "@/features/target/context";
import { CardTargetBar } from "@/features/target/CardTargetBar";
import { NextStepBar } from "@/features/target/NextStepBar";

const CACHE_STORAGE_KEY = "pm3-cache";
const TAB_STORAGE_KEY = "pm3-active-tab";
const TRANSPORT_STORAGE_KEY = "pm3-transport";
const CACHE_PATH_PREFIX = "/pm3-cache";
// Panel tabs that run pm3 commands → show the terminal dock by default. Others
// (memory, hex, library, utilities, settings) hide it until a command runs.
const COMMAND_PANEL_TABS = new Set(["attacks", "magic", "lfops", "t55xx", "traffic"]);
const TRANSPORT_TYPES: TransportType[] = ["webserial", "tauri-serial", "tauri-bluetooth"];
const ANSI_ESCAPE_CHAR = String.fromCharCode(27);
const ANSI_ESCAPE_REGEX = new RegExp(
  `${ANSI_ESCAPE_CHAR}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`,
  "g",
);

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_REGEX, "");
}

function App() {
  const terminalRef = useRef<TerminalHandle>(null);
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === "undefined") return "connect";
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    return saved && RIBBON_TABS.some((tab) => tab.value === saved) ? saved : "connect";
  });
  const [quickCommand, setQuickCommand] = useState("hf search");
  // Terminal dock visibility under a panel: defaults per-tab, can be toggled, and
  // pops open whenever a command is dispatched (see handleCommand).
  const [terminalDockOpen, setTerminalDockOpen] = useState(true);
  const [selectedTransport, setSelectedTransport] = useState<TransportType | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem(TRANSPORT_STORAGE_KEY) as TransportType | null;
    return saved && TRANSPORT_TYPES.includes(saved) ? saved : null;
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const { commandHistory, pushCommand } = useCommandHistory();
  const { theme, setTheme } = useTheme();
  const outputLineBufferRef = useRef("");
  const writeTerminalLine = useCallback((line: string) => {
    terminalRef.current?.writeln(line);
  }, []);

  const { activeDump, cachedDumps, handleDumpDelete, handleDumpRename, upsertCachedDump } =
    useDumpStore({
      onActivateMemory: () => setActiveTab("memory"),
      onLog: writeTerminalLine,
    });
  // The active "card target" — the single source of truth for the card the
  // whole workbench is operating on. Scan/dump results flow into it here; every
  // panel reads it through CardTargetContext.
  const cardTarget = useCardTarget({ activeDump });
  const { mergeIdentity, clearTarget } = cardTarget;
  const tagInfo = cardTarget.target.identity;
  const [cachedAssets, setCachedAssets] = useState<CachedAssetWithData[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(CACHE_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as CachedAssetWithData[]) : [];
      return parsed
        .filter((item) => Boolean((item as CachedAssetWithData).base64))
        .map((item) => ({ ...item, base64: (item as CachedAssetWithData).base64 || "" }));
    } catch (e) {
      console.error("Failed to parse cache", e);
      return [];
    }
  });
  const [isSyncingCache, setIsSyncingCache] = useState(false);

  // Parse tag information from output and feed it into the active card target.
  const parseTagInfo = useCallback(
    (text: string) => {
      if (text.includes("UID:") || text.includes("uid:")) {
        const uidMatch = text.match(/[Uu][Ii][Dd][:\s]+([A-Fa-f0-9\s:]+)/);
        if (uidMatch) {
          mergeIdentity({ uid: uidMatch[1].trim().replace(/\s+/g, ":") });
        }
      }
      if (text.includes("MIFARE")) {
        const typeMatch = text.match(/(MIFARE\s+\w+(?:\s+\w+)?)/i);
        if (typeMatch) {
          mergeIdentity({ type: typeMatch[1], protocol: "HF", subtype: "MIFARE" });
        }
      }
      if (text.includes("SAK:") || text.includes("sak:")) {
        const sakMatch = text.match(/[Ss][Aa][Kk][:\s]+([A-Fa-f0-9]+)/);
        if (sakMatch) {
          mergeIdentity({ sak: sakMatch[1] });
        }
      }
      if (text.includes("ATQA:") || text.includes("atqa:")) {
        const atqaMatch = text.match(/[Aa][Tt][Qq][Aa][:\s]+([A-Fa-f0-9\s]+)/);
        if (atqaMatch) {
          mergeIdentity({ atqa: atqaMatch[1].trim() });
        }
      }
    },
    [mergeIdentity],
  );

  const detectKind = useCallback((fileName: string): CachedAssetKind => {
    const ext = fileName.toLowerCase();
    if (ext.endsWith(".dic") || ext.includes("key")) return "keys";
    if (
      ext.endsWith(".bin") ||
      ext.endsWith(".dump") ||
      ext.endsWith(".eml") ||
      ext.endsWith(".json")
    )
      return "dump";
    if (ext.endsWith(".lua")) return "script";
    return "raw";
  }, []);

  const upsertCachedAsset = useCallback((asset: CachedAssetWithData) => {
    const cacheKey = asset.relativePath || asset.name;

    setCachedAssets((prev) => {
      const existing = prev.find((item) => (item.relativePath || item.name) === cacheKey);
      const nextItem = existing ? { ...existing, ...asset, id: existing.id } : asset;

      return [
        nextItem,
        ...prev.filter((item) => (item.relativePath || item.name) !== cacheKey),
      ].slice(0, 30);
    });
  }, []);

  const uint8ToBase64 = useCallback((bytes: Uint8Array) => {
    let binary = "";
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      for (const value of chunk) {
        binary += String.fromCharCode(value);
      }
    }

    return btoa(binary);
  }, []);

  const readFsBytes = useCallback((filePath: string): Uint8Array | null => {
    if (typeof window === "undefined") return null;

    const globalWindow = window as typeof window & {
      FS?: EmscriptenFSLike;
      Module?: { FS?: EmscriptenFSLike };
    };
    const FS = globalWindow.FS || globalWindow.Module?.FS;
    if (!FS?.readFile) return null;

    try {
      const exists = FS.analyzePath ? FS.analyzePath(filePath)?.exists : true;
      if (!exists) return null;

      const data = FS.readFile(filePath, { encoding: "binary" });
      if (data instanceof Uint8Array) return data;
      if (Array.isArray(data)) return Uint8Array.from(data);
      if (typeof data === "string") {
        const bytes = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
          bytes[i] = data.charCodeAt(i);
        }
        return bytes;
      }
    } catch (error) {
      console.error(`Failed to read generated file: ${filePath}`, error);
    }

    return null;
  }, []);

  const cacheGeneratedArtifact = useCallback(
    (filePath: string) => {
      const normalizedPath = stripAnsi(filePath).trim().replace(/^`|`$/g, "");
      const name = normalizedPath.split("/").pop();
      if (!name) return;
      // Match key/dump artifacts incl. numbered suffixes PM3 adds to avoid
      // overwrites (e.g. hf-mf-<uid>-dump-001.json, -key-001.bin).
      if (!/-(?:key(?:-\d+)?\.bin|dump(?:-\d+)?\.(?:bin|json))$/i.test(name)) return;

      const bytes = readFsBytes(normalizedPath);
      if (!bytes) return;

      upsertCachedAsset({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${name}`,
        name,
        relativePath: name,
        kind: detectKind(name),
        size: bytes.byteLength,
        base64: uint8ToBase64(bytes),
        updatedAt: Date.now(),
      });

      if (name.toLowerCase().endsWith(".json")) {
        try {
          const parsed = JSON.parse(new TextDecoder().decode(bytes)) as PM3DumpJson;
          if (parsed.blocks || parsed.Card) {
            const cachedDump = upsertCachedDump(parsed, name, { activate: false, announce: false });
            importDumpKeysToLibrary(cachedDump.data, cachedDump.id);
            const derived = tagInfoFromDump(parsed);
            if (derived) mergeIdentity(derived, "dump");
          }
        } catch (error) {
          console.error(`Failed to parse generated dump JSON: ${name}`, error);
        }
      }

      writeTerminalLine(`\x1b[32mCached generated file: ${name}\x1b[0m`);
    },
    [
      detectKind,
      mergeIdentity,
      readFsBytes,
      uint8ToBase64,
      upsertCachedAsset,
      upsertCachedDump,
      writeTerminalLine,
    ],
  );

  const processGeneratedOutputLine = useCallback(
    (line: string) => {
      const cleanLine = stripAnsi(line);

      const binaryMatch = cleanLine.match(
        /(?:Found keys have been dumped to|Saved \d+ bytes to binary file)\s+`([^`]+)`/,
      );
      if (binaryMatch) {
        cacheGeneratedArtifact(binaryMatch[1]);
      }

      const jsonMatch = cleanLine.match(/Saved to json file\s+([^\s`]+)/);
      if (jsonMatch) {
        cacheGeneratedArtifact(jsonMatch[1]);
      }
    },
    [cacheGeneratedArtifact],
  );

  const handleDumpLoad = useCallback(
    (dump: PM3DumpJson, name: string) => {
      const cachedDump = upsertCachedDump(dump, name, { activate: true, announce: true });
      importDumpKeysToLibrary(cachedDump.data, cachedDump.id);
      const derived = tagInfoFromDump(dump);
      if (derived) mergeIdentity(derived, "dump");
    },
    [mergeIdentity, upsertCachedDump],
  );

  // WASM output handler
  const handleWasmOutput = useCallback(
    (text: string) => {
      terminalRef.current?.write(text);
      parseTagInfo(text);

      const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const lines = `${outputLineBufferRef.current}${normalized}`.split("\n");
      outputLineBufferRef.current = lines.pop() ?? "";
      lines.forEach(processGeneratedOutputLine);
    },
    [parseTagInfo, processGeneratedOutputLine],
  );

  // WASM hooks
  const wasmState = useProxmarkWasm({
    onOutput: handleWasmOutput,
    onReady: () => {
      terminalRef.current?.writeln("\x1b[32mWASM client loaded successfully!\x1b[0m");
      terminalRef.current?.writeln(
        '\x1b[90mProxmark3 WASM client ready. Type "help" for commands.\x1b[0m',
      );
    },
    onError: (err) => {
      terminalRef.current?.writeln(`\x1b[31mWASM Error: ${err.message}\x1b[0m`);
    },
  });

  const fileToBase64 = useCallback(
    (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const buffer = reader.result as ArrayBuffer;
          const uint8 = new Uint8Array(buffer);
          let binary = "";
          for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i]);
          }
          resolve(btoa(binary));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
      }),
    [],
  );

  const sanitizeRelativePath = useCallback((file: File): string => {
    const withPath =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const parts = withPath.split(/[\\/]/).filter(Boolean);
    if (parts.length > 1) {
      parts.shift(); // drop the top-level folder (e.g., "Card Export")
    }
    const withoutRoot = parts.join("/") || file.name;
    // Avoid spaces/special chars that could break pm3 CLI parsing
    const safe = withoutRoot.replace(/\s+/g, "_").replace(/[^A-Za-z0-9._/-]/g, "_");
    return safe;
  }, []);

  const cachePathFor = useCallback((asset: CachedAsset) => {
    return `${CACHE_PATH_PREFIX}/${asset.relativePath || asset.name}`;
  }, []);

  const syncCacheToFS = useCallback(() => {
    if (!cachedAssets.length) return false;
    if (!wasmState.isReady) {
      terminalRef.current?.writeln(
        "\x1b[33mWASM not ready yet; cache will sync once it is.\x1b[0m",
      );
      return false;
    }

    const win = window as unknown as Record<string, unknown>;
    const FS = (win.FS || (win.Module as Record<string, unknown> | undefined)?.FS) as
      | EmscriptenFSLike
      | undefined;
    if (!FS?.writeFile) {
      terminalRef.current?.writeln(
        "\x1b[31mCannot push cache: Emscripten FS not available.\x1b[0m",
      );
      return false;
    }

    setIsSyncingCache(true);
    try {
      const pathInfo = FS.analyzePath ? FS.analyzePath(CACHE_PATH_PREFIX) : { exists: false };
      if (!pathInfo?.exists) {
        if (FS.mkdirTree) {
          FS.mkdirTree(CACHE_PATH_PREFIX);
        } else if (FS.mkdir) {
          FS.mkdir(CACHE_PATH_PREFIX);
        }
      }

      const ensureDir = (targetPath: string) => {
        const dirPath = targetPath.slice(0, targetPath.lastIndexOf("/"));
        if (!dirPath || dirPath === CACHE_PATH_PREFIX) return;
        const exists = FS.analyzePath ? FS.analyzePath(dirPath)?.exists : false;
        if (exists) return;
        if (FS.mkdirTree) {
          FS.mkdirTree(dirPath);
          return;
        }
        if (!FS.mkdir) return;
        const parts = dirPath.split("/").filter(Boolean);
        let current = "";
        for (const part of parts) {
          current += `/${part}`;
          const currentPath = current;
          const currentExists = FS.analyzePath ? FS.analyzePath(currentPath)?.exists : false;
          if (!currentExists) {
            try {
              FS.mkdir(currentPath);
            } catch {
              // ignore
            }
          }
        }
      };

      for (const asset of cachedAssets) {
        if (!asset.base64) continue;
        const binary = atob(asset.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const targetPath = cachePathFor(asset);
        ensureDir(targetPath);
        FS.writeFile(targetPath, bytes, { flags: "w+" });
      }
      terminalRef.current?.writeln(
        `\x1b[32mSynced ${cachedAssets.length} cached files to ${CACHE_PATH_PREFIX}/\x1b[0m`,
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      terminalRef.current?.writeln(`\x1b[31mCache sync failed: ${message}\x1b[0m`);
      return false;
    } finally {
      setIsSyncingCache(false);
    }
  }, [cachePathFor, cachedAssets, wasmState.isReady]);

  const handleCacheUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const uploads: CachedAssetWithData[] = [];

      for (const file of Array.from(files)) {
        const base64 = await fileToBase64(file);
        const relativePath = sanitizeRelativePath(file);
        const detectionName = relativePath.split("/").pop() || file.name;
        uploads.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${file.name}`,
          name: file.name,
          relativePath,
          kind: detectKind(detectionName),
          size: file.size,
          base64,
          updatedAt: Date.now(),
        });
      }

      setCachedAssets((prev) => [...uploads, ...prev].slice(0, 30));
      setTimeout(syncCacheToFS, 50);
    },
    [detectKind, fileToBase64, sanitizeRelativePath, syncCacheToFS],
  );

  const handleCacheDelete = useCallback((id: string) => {
    setCachedAssets((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Handle loading a dump (from file or cache)
  const handleJsonUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      for (const file of Array.from(files)) {
        if (file.name.endsWith(".json")) {
          const text = await file.text();
          try {
            const parsed = JSON.parse(text) as PM3DumpJson;
            if (parsed.blocks || parsed.Card) {
              handleDumpLoad(parsed, file.name);
              break;
            }
          } catch {
            terminalRef.current?.writeln(`\x1b[31mFailed to parse JSON: ${file.name}\x1b[0m`);
          }
        }
      }
    },
    [handleDumpLoad],
  );

  // Handle command execution
  const handleCommand = useCallback(
    (cmd: string) => {
      pushCommand(cmd);
      // Pop the terminal dock open so output is visible, even on panels that
      // hide it by default (e.g. running a command from Memory).
      setTerminalDockOpen(true);

      // Handle local clear command
      if (cmd === "clear") {
        terminalRef.current?.clear();
        return;
      }

      // Send command to WASM client
      if (wasmState.isReady) {
        wasmState.sendCommand(cmd);
      } else if (wasmState.isLoading) {
        terminalRef.current?.writeln("\x1b[33mWASM client is still loading...\x1b[0m");
      } else {
        terminalRef.current?.writeln("\x1b[31mWASM client failed to load.\x1b[0m");
      }
    },
    [pushCommand, wasmState],
  );

  // Write a small text file straight into the cache FS (no React-state round
  // trip), used to drop a key dictionary in place right before a command.
  const writeCacheTextFile = useCallback((name: string, text: string): string | null => {
    const win = window as unknown as Record<string, unknown>;
    const FS = (win.FS || (win.Module as Record<string, unknown> | undefined)?.FS) as
      | EmscriptenFSLike
      | undefined;
    if (!FS?.writeFile) return null;
    try {
      const info = FS.analyzePath ? FS.analyzePath(CACHE_PATH_PREFIX) : { exists: false };
      if (!info?.exists) {
        if (FS.mkdirTree) FS.mkdirTree(CACHE_PATH_PREFIX);
        else if (FS.mkdir) FS.mkdir(CACHE_PATH_PREFIX);
      }
      const path = `${CACHE_PATH_PREFIX}/${name}`;
      FS.writeFile(path, new TextEncoder().encode(text), { flags: "w+" });
      return path;
    } catch (error) {
      console.error(`Failed to write cache file: ${name}`, error);
      return null;
    }
  }, []);

  // Dump a card using keys already saved in the browser library: export them as
  // a pm3 dictionary and seed autopwn with it (uses known keys first, recovers
  // any missing). The resulting dump flows through cacheGeneratedArtifact.
  const handleDumpWithSavedKeys = useCallback(
    (uid: string, cardType: "1k" | "4k") => {
      if (!wasmState.isReady) {
        terminalRef.current?.writeln("\x1b[33mWASM client is still loading...\x1b[0m");
        return;
      }
      const storedKeys = loadStoredState<StoredKey[]>(KEYS_STORAGE_KEY, []);
      const dictionary = buildKeyDictionary(storedKeys, uid);
      if (!dictionary) {
        terminalRef.current?.writeln(
          "\x1b[33mNo saved keys for this card yet — run Autopwn or Check Keys first.\x1b[0m",
        );
        return;
      }
      const fileName = `hf-mf-${uid || "card"}-saved-keys.dic`;
      const path = writeCacheTextFile(fileName, `${dictionary}\n`);
      if (!path) {
        terminalRef.current?.writeln(
          "\x1b[31mCould not write the key dictionary to the cache filesystem.\x1b[0m",
        );
        return;
      }
      const count = dictionary.split("\n").length;
      terminalRef.current?.writeln(
        `\x1b[36mSeeding dump with ${count} saved key${count === 1 ? "" : "s"} → ${path}\x1b[0m`,
      );
      handleCommand(`hf mf autopwn --${cardType} -f ${path}`);
    },
    [handleCommand, writeCacheTextFile, wasmState.isReady],
  );

  const handleCacheUse = useCallback(
    (asset: CachedAsset, template: string) => {
      const synced = syncCacheToFS();
      const cmd = template.replace("{{path}}", cachePathFor(asset));
      if (synced === false) {
        terminalRef.current?.writeln(
          "\x1b[33mCache not synced yet; sending command anyway.\x1b[0m",
        );
      }
      handleCommand(cmd);
    },
    [cachePathFor, handleCommand, syncCacheToFS],
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cachedAssets));
    }
  }, [cachedAssets]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TAB_STORAGE_KEY, activeTab);
    }
  }, [activeTab]);

  // Reset terminal dock visibility to the active panel's default on tab change.
  useEffect(() => {
    setTerminalDockOpen(COMMAND_PANEL_TABS.has(activeTab));
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedTransport) {
      localStorage.setItem(TRANSPORT_STORAGE_KEY, selectedTransport);
    } else {
      localStorage.removeItem(TRANSPORT_STORAGE_KEY);
    }
  }, [selectedTransport]);

  useEffect(() => {
    if (wasmState.isReady && cachedAssets.length) {
      syncCacheToFS();
    }
  }, [cachedAssets.length, wasmState.isReady, syncCacheToFS]);

  useEffect(() => {
    cachedDumps.forEach((dump) => {
      importDumpKeysToLibrary(dump.data, dump.id);
    });
  }, [cachedDumps]);

  // Set up unresponsive device handler
  useEffect(() => {
    pm3WebUSB.onUnresponsive = () => {
      terminalRef.current?.writeln(
        '\x1b[33m[Warning] Device may be unresponsive. Try "Stop" or "Reset" button.\x1b[0m',
      );
    };
    return () => {
      pm3WebUSB.onUnresponsive = undefined;
    };
  }, []);

  const handleConnect = useCallback(async () => {
    if (isConnecting) return;
    const transportType =
      selectedTransport || wasmState.availableTransports[0]?.type || "webserial";
    const transportName = getTransportLabel(transportType, wasmState.availableTransports);

    terminalRef.current?.writeln(`\x1b[36mConnecting to Proxmark3 via ${transportName}...\x1b[0m`);
    if (transportType === "webserial") {
      terminalRef.current?.writeln(
        "\x1b[90mSelect your Proxmark3 device in the browser popup.\x1b[0m",
      );
    } else if (transportType === "tauri-bluetooth") {
      terminalRef.current?.writeln("\x1b[90mSearching for Proxmark3 X Bluetooth device...\x1b[0m");
    }

    setIsConnecting(true);
    try {
      const success = await wasmState.connectDevice(transportType);
      if (success) {
        terminalRef.current?.writeln(`\x1b[32m${transportName} connected!\x1b[0m`);
        terminalRef.current?.writeln("\x1b[90mNow connecting WASM client to device...\x1b[0m");
      } else {
        terminalRef.current?.writeln(
          `\x1b[31m${transportName} connection failed or cancelled.\x1b[0m`,
        );
      }
    } finally {
      setIsConnecting(false);
    }
  }, [wasmState, selectedTransport, isConnecting]);

  const handleDisconnect = useCallback(async () => {
    await wasmState.disconnectDevice();
    terminalRef.current?.writeln("\x1b[33mDisconnected.\x1b[0m");
    clearTarget();
  }, [wasmState, clearTarget]);

  const handleCopyUid = useCallback(() => {
    if (tagInfo?.uid) {
      void navigator.clipboard.writeText(tagInfo.uid);
      terminalRef.current?.writeln(`\x1b[32mUID copied to clipboard: ${tagInfo.uid}\x1b[0m`);
    }
  }, [tagInfo]);

  const handleRefreshTag = useCallback(() => {
    handleCommand("hf 14a info");
  }, [handleCommand]);

  // Handle terminal input in raw mode
  const handleTerminalInput = useCallback(
    (char: string) => {
      if (wasmState.isReady) {
        wasmState.sendInput(char);
      }
    },
    [wasmState],
  );

  const canRunCommands = useMemo(() => {
    return wasmState.isReady;
  }, [wasmState.isReady]);

  const runQuickCommand = useCallback(() => {
    if (!quickCommand.trim()) return;
    handleCommand(quickCommand.trim());
  }, [handleCommand, quickCommand]);

  const hasHardwareTransport = wasmState.availableTransports.length > 0;
  const activeTransportType =
    selectedTransport || wasmState.activeTransportType || wasmState.availableTransports[0]?.type;
  const activeTransportLabel = getTransportLabel(
    activeTransportType,
    wasmState.availableTransports,
  );
  const wasmStatus = wasmState.isLoading
    ? { text: "Loading WASM…", dot: "bg-amber-500 status-pulse" }
    : !wasmState.isReady
      ? {
          text: wasmState.error ? `WASM Error: ${wasmState.error.message}` : "WASM Error",
          dot: "bg-red-500",
        }
      : wasmState.isDeviceConnected
        ? { text: "Device Connected", dot: "bg-green-500" }
        : isConnecting
          ? { text: "Connecting…", dot: "bg-amber-500 status-pulse" }
          : { text: "WASM Ready (Offline)", dot: "bg-blue-500" };
  return (
    <CardTargetContext.Provider value={cardTarget}>
      <div className="h-dvh overflow-hidden flex flex-col bg-background bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.08),transparent_25%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.06),transparent_25%)]">
        {/* Ribbon Toolbar */}
        <RibbonToolbar
          connectionStatus={
            wasmState.isDeviceConnected ? "connected" : isConnecting ? "connecting" : "disconnected"
          }
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onCommand={handleCommand}
          onStopOperation={wasmState.sendBreak}
          onHardReset={wasmState.hardReset}
          theme={theme}
          onThemeChange={setTheme}
          canRunCommands={canRunCommands}
          cacheItems={cachedAssets}
          cacheSyncing={isSyncingCache}
          onCacheUpload={handleCacheUpload}
          onCacheUse={handleCacheUse}
          onCacheDelete={handleCacheDelete}
          onCacheSync={syncCacheToFS}
          cachePathPrefix={CACHE_PATH_PREFIX}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          availableTransports={wasmState.availableTransports}
          selectedTransport={selectedTransport || wasmState.activeTransportType}
          onTransportChange={setSelectedTransport}
          onJsonUpload={handleJsonUpload}
        />
        {/* Persistent active-card strip — visible across every panel. */}
        <CardTargetBar
          onRefresh={handleRefreshTag}
          onCopyUid={handleCopyUid}
          disabled={!canRunCommands}
        />
        {/* Guided next-step spine, driven by the active card target. */}
        <NextStepBar
          onCommand={handleCommand}
          onOpenTab={setActiveTab}
          commandsDisabled={!canRunCommands}
        />
        <MainPanelRouter
          activeTab={activeTab}
          terminalDockOpen={terminalDockOpen}
          onTerminalDockToggle={() => setTerminalDockOpen((open) => !open)}
          onDumpWithSavedKeys={handleDumpWithSavedKeys}
          theme={theme}
          onThemeChange={setTheme}
          terminalRef={terminalRef}
          activeDump={activeDump}
          cachedDumps={cachedDumps}
          cachedAssets={cachedAssets}
          cachePathPrefix={CACHE_PATH_PREFIX}
          canRunCommands={canRunCommands}
          isLoading={wasmState.isLoading}
          isConnecting={isConnecting}
          isDeviceConnected={wasmState.isDeviceConnected}
          hasHardwareTransport={hasHardwareTransport}
          activeTransportLabel={activeTransportLabel}
          commandHistory={commandHistory}
          quickCommand={quickCommand}
          onQuickCommandChange={setQuickCommand}
          onRunQuickCommand={runQuickCommand}
          onCommand={handleCommand}
          onInput={handleTerminalInput}
          onConnect={() => void handleConnect()}
          onDisconnect={() => void handleDisconnect()}
          onCopyUid={handleCopyUid}
          onOpenMemory={() => setActiveTab("memory")}
          onOpenShortcuts={() => setActiveTab("actions")}
          onOpenTab={setActiveTab}
          onLoadSample={() => handleDumpLoad(PRIMARY_SAMPLE_DUMP.data, PRIMARY_SAMPLE_DUMP.name)}
          onRefreshTag={handleRefreshTag}
          onDumpLoad={handleDumpLoad}
          onDumpRename={handleDumpRename}
          onDumpDelete={handleDumpDelete}
          onClearCache={() => setCachedAssets([])}
        />

        {/* Status Bar */}
        <div className="border-t border-border bg-card/80 px-4 py-2 text-xs text-muted-foreground backdrop-blur">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2 md:gap-4">
              <span className="font-medium text-foreground/90">Proxmark3 Web Client</span>
              <span className="flex items-center gap-1.5" title={wasmStatus.text}>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${wasmStatus.dot}`}
                  aria-hidden="true"
                />
                <span className="max-w-[40ch] truncate">{wasmStatus.text}</span>
              </span>
              <span>{activeTransportLabel}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span>Commands: {commandHistory.length}</span>
              <span>Cache: {cachedAssets.length}</span>
              <span>Dumps: {cachedDumps.length}</span>
            </div>
          </div>
        </div>
      </div>
    </CardTargetContext.Provider>
  );
}

export default App;
