import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import { RibbonToolbar } from "@/components/ribbon/RibbonToolbar";
import { Terminal, type TerminalHandle } from "@/components/terminal/Terminal";
import { TagInfoPanel, type TagInfo } from "@/components/panels/TagInfoPanel";
import { useProxmarkWasm } from "@/hooks/useProxmarkWasm";
import { useTheme } from "@/hooks/useTheme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type CachedAsset, type CachedAssetKind } from "@/components/panels/KeyCachePanel";
import { HexAsciiViewer } from "@/components/panels/HexAsciiViewer";
import {
  CardMemoryMap,
  type PM3DumpJson,
  type CachedDump,
} from "@/components/panels/CardMemoryMap";
import { MifareAttacksPanel } from "@/components/panels/MifareAttacksPanel";
import { MagicCardPanel } from "@/components/panels/MagicCardPanel";
import { LFOperationsPanel } from "@/components/panels/LFOperationsPanel";
import { T55xxPanel } from "@/components/panels/T55xxPanel";
import { TrafficCapturePanel } from "@/components/panels/TrafficCapturePanel";
import { SettingsPanel } from "@/components/panels/SettingsPanel";
import { Activity, Send, Sparkles, Trash2 } from "lucide-react";
import type { TransportType } from "@/lib/transports";
import pm3WebUSB from "@/lib/pm3WebUSB";

type CachedAssetWithData = CachedAsset & { base64: string };
type EmscriptenFSLike = {
  analyzePath?: (path: string) => { exists?: boolean };
  mkdir?: (path: string) => void;
  mkdirTree?: (path: string) => void;
  readFile?: (
    path: string,
    opts?: { encoding?: "binary" | "utf8"; flags?: string },
  ) => Uint8Array | string | number[];
  writeFile?: (path: string, data: Uint8Array, opts?: { flags?: string }) => void;
};

const CACHE_STORAGE_KEY = "pm3-cache";
const CACHE_PATH_PREFIX = "/pm3-cache";
const DUMP_CACHE_KEY = "pm3-dumps";

function App() {
  const terminalRef = useRef<TerminalHandle>(null);
  const [tagInfo, setTagInfo] = useState<TagInfo | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("connect");
  const [quickCommand, setQuickCommand] = useState("hf search");
  const [selectedTransport, setSelectedTransport] = useState<TransportType | null>(null);

  // Cached dumps with localStorage persistence
  const [cachedDumps, setCachedDumps] = useState<CachedDump[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(DUMP_CACHE_KEY);
      return raw ? (JSON.parse(raw) as CachedDump[]) : [];
    } catch (e) {
      console.error("Failed to parse cached dumps", e);
      return [];
    }
  });
  const [activeDumpId, setActiveDumpId] = useState<string | null>(null);

  // Get the active dump from cached dumps
  const activeDump = useMemo(() => {
    return cachedDumps.find((d) => d.id === activeDumpId) || null;
  }, [cachedDumps, activeDumpId]);
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
  const { theme, setTheme } = useTheme();
  const outputLineBufferRef = useRef("");

  // Parse tag information from output
  const parseTagInfo = useCallback((text: string) => {
    if (text.includes("UID:") || text.includes("uid:")) {
      const uidMatch = text.match(/[Uu][Ii][Dd][:\s]+([A-Fa-f0-9\s:]+)/);
      if (uidMatch) {
        setTagInfo((prev) => ({
          ...prev,
          uid: uidMatch[1].trim().replace(/\s+/g, ":"),
        }));
      }
    }
    if (text.includes("MIFARE")) {
      const typeMatch = text.match(/(MIFARE\s+\w+(?:\s+\w+)?)/i);
      if (typeMatch) {
        setTagInfo((prev) => ({
          ...prev,
          type: typeMatch[1],
          protocol: "HF",
          subtype: "MIFARE",
        }));
      }
    }
    if (text.includes("SAK:") || text.includes("sak:")) {
      const sakMatch = text.match(/[Ss][Aa][Kk][:\s]+([A-Fa-f0-9]+)/);
      if (sakMatch) {
        setTagInfo((prev) => ({
          ...prev,
          sak: sakMatch[1],
        }));
      }
    }
    if (text.includes("ATQA:") || text.includes("atqa:")) {
      const atqaMatch = text.match(/[Aa][Tt][Qq][Aa][:\s]+([A-Fa-f0-9\s]+)/);
      if (atqaMatch) {
        setTagInfo((prev) => ({
          ...prev,
          atqa: atqaMatch[1].trim(),
        }));
      }
    }
  }, []);

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

  const upsertCachedDump = useCallback(
    (
      dump: PM3DumpJson,
      name: string,
      options?: {
        activate?: boolean;
        announce?: boolean;
      },
    ) => {
      const activate = options?.activate ?? false;
      const announce = options?.announce ?? false;
      const uid = dump.Card?.UID;
      const existing = uid ? cachedDumps.find((d) => d.data.Card?.UID === uid) : undefined;
      const cachedAt = Date.now();

      if (existing) {
        const updated: CachedDump = {
          ...existing,
          name,
          data: dump,
          cachedAt,
        };
        setCachedDumps((prev) =>
          [updated, ...prev.filter((d) => d.id !== existing.id)].slice(0, 10),
        );
        if (activate) {
          setActiveDumpId(existing.id);
        }
      } else {
        const newDump: CachedDump = {
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${name}`,
          name,
          data: dump,
          cachedAt,
        };
        setCachedDumps((prev) => [newDump, ...prev].slice(0, 10));
        if (activate) {
          setActiveDumpId(newDump.id);
        }
      }

      if (activate) {
        setActiveTab("memory");
      }

      if (announce) {
        terminalRef.current?.writeln(`\x1b[32mLoaded dump: ${name}\x1b[0m`);
        if (dump.Card?.UID) {
          terminalRef.current?.writeln(`\x1b[36mCard UID: ${dump.Card.UID}\x1b[0m`);
        }
      }
    },
    [cachedDumps],
  );

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
      const normalizedPath = filePath.trim().replace(/^`|`$/g, "");
      const name = normalizedPath.split("/").pop();
      if (!name) return;
      if (!/(?:-key\.bin|-dump\.bin|-dump\.json)$/i.test(name)) return;

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
            upsertCachedDump(parsed, name, { activate: false, announce: false });
          }
        } catch (error) {
          console.error(`Failed to parse generated dump JSON: ${name}`, error);
        }
      }

      terminalRef.current?.writeln(`\x1b[32mCached generated file: ${name}\x1b[0m`);
    },
    [detectKind, readFsBytes, uint8ToBase64, upsertCachedAsset, upsertCachedDump],
  );

  const processGeneratedOutputLine = useCallback(
    (line: string) => {
      const binaryMatch = line.match(
        /(?:Found keys have been dumped to|Saved \d+ bytes to binary file)\s+`([^`]+)`/,
      );
      if (binaryMatch) {
        cacheGeneratedArtifact(binaryMatch[1]);
      }

      const jsonMatch = line.match(/Saved to json file\s+([^\s`]+)/);
      if (jsonMatch) {
        cacheGeneratedArtifact(jsonMatch[1]);
      }
    },
    [cacheGeneratedArtifact],
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
  const handleDumpLoad = useCallback(
    (dump: PM3DumpJson, name: string) => {
      upsertCachedDump(dump, name, { activate: true, announce: true });
    },
    [upsertCachedDump],
  );

  // Handle renaming a cached dump
  const handleDumpRename = useCallback((id: string, newName: string) => {
    setCachedDumps((prev) => prev.map((d) => (d.id === id ? { ...d, name: newName } : d)));
    terminalRef.current?.writeln(`\x1b[32mRenamed dump to: ${newName}\x1b[0m`);
  }, []);

  // Handle deleting a cached dump
  const handleDumpDelete = useCallback(
    (id: string) => {
      const dump = cachedDumps.find((d) => d.id === id);
      setCachedDumps((prev) => prev.filter((d) => d.id !== id));
      if (activeDumpId === id) {
        setActiveDumpId(null);
      }
      if (dump) {
        terminalRef.current?.writeln(`\x1b[33mDeleted dump: ${dump.name}\x1b[0m`);
      }
    },
    [cachedDumps, activeDumpId],
  );

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
      setCommandHistory((prev) => [...prev.slice(-99), cmd]);

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
    [wasmState],
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

  // Persist cached dumps to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(DUMP_CACHE_KEY, JSON.stringify(cachedDumps));
    }
  }, [cachedDumps]);

  useEffect(() => {
    if (wasmState.isReady && cachedAssets.length) {
      syncCacheToFS();
    }
  }, [cachedAssets.length, wasmState.isReady, syncCacheToFS]);

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
    const transportType =
      selectedTransport || wasmState.availableTransports[0]?.type || "webserial";
    const transportName =
      transportType === "tauri-bluetooth"
        ? "Bluetooth"
        : transportType === "tauri-serial"
          ? "Native Serial"
          : "WebSerial";

    terminalRef.current?.writeln(`\x1b[36mConnecting to Proxmark3 via ${transportName}...\x1b[0m`);
    if (transportType === "webserial") {
      terminalRef.current?.writeln(
        "\x1b[90mSelect your Proxmark3 device in the browser popup.\x1b[0m",
      );
    } else if (transportType === "tauri-bluetooth") {
      terminalRef.current?.writeln("\x1b[90mSearching for Proxmark3 X Bluetooth device...\x1b[0m");
    }

    const success = await wasmState.connectDevice(transportType);
    if (success) {
      terminalRef.current?.writeln(`\x1b[32m${transportName} connected!\x1b[0m`);
      terminalRef.current?.writeln("\x1b[90mNow connecting WASM client to device...\x1b[0m");
    } else {
      terminalRef.current?.writeln(
        `\x1b[31m${transportName} connection failed or cancelled.\x1b[0m`,
      );
    }
  }, [wasmState, selectedTransport]);

  const handleDisconnect = useCallback(async () => {
    await wasmState.disconnectDevice();
    terminalRef.current?.writeln("\x1b[33mDisconnected.\x1b[0m");
    setTagInfo(null);
  }, [wasmState]);

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

  return (
    <div className="min-h-screen flex flex-col bg-background bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.08),transparent_25%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.06),transparent_25%)]">
      {/* Ribbon Toolbar */}
      <RibbonToolbar
        connectionStatus={wasmState.isDeviceConnected ? "connected" : "disconnected"}
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

      {/* Main Content Area */}
      {activeTab === "memory" ? (
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          <CardMemoryMap
            onCommand={handleCommand}
            disabled={!canRunCommands}
            cachedDumps={cachedDumps}
            onDumpLoad={handleDumpLoad}
            onDumpRename={handleDumpRename}
            onDumpDelete={handleDumpDelete}
            activeDump={activeDump}
          />
        </div>
      ) : activeTab === "hex" ? (
        <div className="flex-1 p-4 overflow-hidden">
          <div className="h-full max-w-4xl mx-auto">
            <HexAsciiViewer dumps={cachedAssets} />
          </div>
        </div>
      ) : activeTab === "attacks" ? (
        <div className="flex-1 p-4 overflow-hidden">
          <div className="h-full max-w-2xl mx-auto">
            <MifareAttacksPanel
              onCommand={handleCommand}
              disabled={!canRunCommands}
              cachedAssets={cachedAssets}
              cachePathPrefix={CACHE_PATH_PREFIX}
            />
          </div>
        </div>
      ) : activeTab === "magic" ? (
        <div className="flex-1 p-4 overflow-hidden">
          <div className="h-full max-w-2xl mx-auto">
            <MagicCardPanel
              onCommand={handleCommand}
              disabled={!canRunCommands}
              currentUid={tagInfo?.uid?.replace(/:/g, "")}
              currentAtqa={tagInfo?.atqa?.replace(/\s/g, "")}
              currentSak={tagInfo?.sak}
            />
          </div>
        </div>
      ) : activeTab === "lfops" ? (
        <div className="flex-1 p-4 overflow-hidden">
          <div className="h-full max-w-2xl mx-auto">
            <LFOperationsPanel onCommand={handleCommand} disabled={!canRunCommands} />
          </div>
        </div>
      ) : activeTab === "t55xx" ? (
        <div className="flex-1 p-4 overflow-hidden">
          <div className="h-full max-w-2xl mx-auto">
            <T55xxPanel onCommand={handleCommand} disabled={!canRunCommands} />
          </div>
        </div>
      ) : activeTab === "traffic" ? (
        <div className="flex-1 p-4 overflow-hidden">
          <div className="h-full max-w-4xl mx-auto">
            <TrafficCapturePanel onCommand={handleCommand} disabled={!canRunCommands} />
          </div>
        </div>
      ) : activeTab === "settings" ? (
        <div className="flex-1 p-4 overflow-hidden">
          <div className="h-full max-w-xl mx-auto">
            <SettingsPanel
              theme={theme}
              onThemeChange={setTheme}
              cacheCount={cachedAssets.length}
              onClearCache={() => setCachedAssets([])}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4 p-4 overflow-hidden">
          {/* Left Panel - Tag Info & History */}
          <div className="flex flex-col gap-4 min-h-0">
            <TagInfoPanel
              tagInfo={tagInfo}
              onRefresh={handleRefreshTag}
              onCopyUid={handleCopyUid}
              onCommand={handleCommand}
              disabled={!canRunCommands}
            />

            <Card className="flex-1 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Recent Commands
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto">
                <div className="space-y-1">
                  {commandHistory
                    .slice(-12)
                    .reverse()
                    .map((cmd, i) => (
                      <div
                        key={i}
                        className="text-xs font-mono text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={() => handleCommand(cmd)}
                      >
                        {cmd}
                      </div>
                    ))}
                  {commandHistory.length === 0 && (
                    <p className="text-xs text-muted-foreground">No commands yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Terminal */}
          <div className="flex flex-col gap-3 min-w-0 min-h-0">
            <Card className="flex-1 overflow-hidden">
              <CardHeader className="pb-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span>Terminal</span>
                    {canRunCommands ? (
                      <Badge variant="success">Ready</Badge>
                    ) : wasmState.isLoading ? (
                      <Badge variant="warning">Loading...</Badge>
                    ) : (
                      <Badge variant="secondary">Offline</Badge>
                    )}
                    {wasmState.isDeviceConnected && (
                      <Badge variant="outline">Device Connected</Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleCommand("help")}>
                      Help
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => terminalRef.current?.clear()}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={quickCommand}
                    onChange={(e) => setQuickCommand(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runQuickCommand()}
                    placeholder="Send raw pm3 commands (hf mf autopwn --1k -f /pm3-cache/mfc_default_keys)"
                    className="flex-1"
                  />
                  <Button size="sm" onClick={runQuickCommand}>
                    <Send className="h-3 w-3 mr-1" />
                    Send
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setQuickCommand("hf mf autopwn --1k")}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Autopwn
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setQuickCommand("hw tune")}>
                    Tune
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setQuickCommand("hf iclass dump --ki 0")}
                  >
                    iCLASS
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <Terminal
                  ref={terminalRef}
                  onCommand={handleCommand}
                  onInput={handleTerminalInput}
                  rawMode={true}
                  className="h-full"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="h-8 bg-card border-t border-border px-4 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Proxmark3 Web Client</span>
          <span>•</span>
          <span>
            {wasmState.isLoading
              ? "Loading WASM..."
              : wasmState.isReady
                ? wasmState.isDeviceConnected
                  ? "Device Connected"
                  : "WASM Ready (Offline)"
                : "WASM Error"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>Commands: {commandHistory.length}</span>
          <span>|</span>
          <span>Cache: {cachedAssets.length}</span>
        </div>
      </div>
    </div>
  );
}

export default App;
