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
import { type EmscriptenFSLike } from "@/features/workbench/types";
import { buildKeyDictionary } from "@/components/panels/library/utils";
import { vaultStats } from "@/features/vault/vault";
import {
  useVaultAssets,
  useVaultCards,
  useVaultKeys,
  useVaultLfCards,
  useVaultOperations,
} from "@/features/vault/hooks";
import {
  clearAssets,
  deleteAsset,
  importDumpKeys,
  lfMatchKey,
  putAsset,
  putOperation,
  setLfCardMeta,
  upsertLfCard,
} from "@/features/vault/operations";
import type { AssetRecord } from "@/features/vault/db";
import {
  lfCredentialToTagInfo,
  parseLfCredential,
  parseT55xxDetect,
} from "@/features/lf-tools/lfParse";
import { parseMagicInfo } from "@/features/magic/detect";
import {
  DEFAULT_WORKSPACE,
  getWorkspace,
  resolveWorkspace,
  type RibbonStripId,
} from "@/features/ribbon/config";
import { PRIMARY_SAMPLE_DUMP } from "@/features/memory/demo/sampleDumps";
import { importDumpFile } from "@/features/memory/lib/import";
import { tagInfoFromDump } from "@/features/tag-info/fromDump";
import { useCardTarget } from "@/features/target/useCardTarget";
import { CardTargetContext } from "@/features/target/context";
import { CommandCenterContext } from "@/features/commands/context";
import { isPromptLine } from "@/features/commands/prompt";
import type { CommandCenter } from "@/features/commands/types";
import { useCommandCenter } from "@/features/commands/useCommandCenter";
import { deriveConnectionState } from "@/features/connection/model";
import { ActivityBar } from "@/features/workbench/components/ActivityBar";
import { operationFromJob } from "@/features/operations/classify";
import { DeviceProfileContext } from "@/features/device/context";
import { emptyDeviceProfile, inferDeviceProfile } from "@/features/device/infer";
import type { DeviceProfile } from "@/features/device/types";

const TAB_STORAGE_KEY = "pm3-active-tab";
const TERMINAL_DOCK_STORAGE_KEY = "pm3-terminal-dock";
const TRANSPORT_STORAGE_KEY = "pm3-transport";
const CACHE_PATH_PREFIX = "/pm3-cache";
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
  // Two independent pieces of navigation state: the workspace decides which
  // panel fills the view, the strip decides which command band the ribbon
  // shows. Fusing them is what used to make the ribbon throw away your panel.
  const [activeWorkspace, setActiveWorkspace] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_WORKSPACE;
    return resolveWorkspace(localStorage.getItem(TAB_STORAGE_KEY)).workspace;
  });
  const [activeStrip, setActiveStrip] = useState<RibbonStripId>(() => {
    if (typeof window === "undefined") return "connect";
    const saved = resolveWorkspace(localStorage.getItem(TAB_STORAGE_KEY));
    return saved.strip ?? getWorkspace(saved.workspace).strips[0];
  });
  const [quickCommand, setQuickCommand] = useState("hf search");
  // Terminal dock visibility is a persisted, global preference. It deliberately
  // does *not* reset per workspace: a command started in Attacks has to stay
  // watchable while you read its results in Memory or Library.
  const [terminalDockOpen, setTerminalDockOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(TERMINAL_DOCK_STORAGE_KEY) !== "0";
  });
  const [selectedTransport, setSelectedTransport] = useState<TransportType | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem(TRANSPORT_STORAGE_KEY) as TransportType | null;
    return saved && TRANSPORT_TYPES.includes(saved) ? saved : null;
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceProfile, setDeviceProfile] = useState<DeviceProfile>(emptyDeviceProfile);
  const { commandHistory, pushCommand } = useCommandHistory();
  const { theme, setTheme } = useTheme();
  const outputLineBufferRef = useRef("");
  const structuredOutputLinesRef = useRef<string[]>([]);
  const activeLfCardIdRef = useRef<string | null>(null);
  const lfUpsertQueueRef = useRef<Promise<void>>(Promise.resolve());
  const writeTerminalLine = useCallback((line: string) => {
    terminalRef.current?.writeln(line);
  }, []);

  // Switching workspace keeps the current command strip when the destination
  // also offers it, so navigating never silently changes what you can run.
  const openWorkspace = useCallback((value: string) => {
    const resolved = resolveWorkspace(value);
    const workspace = getWorkspace(resolved.workspace);
    setActiveWorkspace(workspace.value);
    setActiveStrip(
      (current) =>
        resolved.strip ?? (workspace.strips.includes(current) ? current : workspace.strips[0]),
    );
  }, []);

  const { activeDump, cachedDumps, handleDumpDelete, handleDumpRename, upsertCachedDump } =
    useDumpStore({
      onActivateMemory: () => openWorkspace("memory"),
      onLog: writeTerminalLine,
    });
  // All vault data is now Dexie-backed live queries — no localStorage state here.
  const cachedAssets = useVaultAssets();
  const vaultKeys = useVaultKeys();
  const vaultCards = useVaultCards();
  const vaultLfCards = useVaultLfCards();
  const vaultOperations = useVaultOperations();
  const [isSyncingCache, setIsSyncingCache] = useState(false);

  // The active "card target" — the single source of truth for the card the
  // whole workbench is operating on. Scan/dump results flow into it here; every
  // panel reads it through CardTargetContext. It also carries the card's vault
  // bundle (saved keys, related dumps and files) resolved from the live stores.
  const cardTarget = useCardTarget({
    activeDump,
    cachedDumps,
    cachedAssets,
    allKeys: vaultKeys,
  });
  const { mergeIdentity, setIdentity, clearTarget, noteLfIdentify, noteMagicIdentify } = cardTarget;
  const tagInfo = cardTarget.target.identity;

  // Parse LF credentials and carrier/magic detects out of terminal output.
  // LF reads print no file, so this is what gives a read a home in the vault and
  // feeds the write/clone UIs their "is the target writable?" gate.
  const parseWriteTargets = useCallback(
    (text: string) => {
      const cred = parseLfCredential(text);
      if (cred) {
        const uid = cred.raw ?? lfMatchKey(cred);
        setIdentity(lfCredentialToTagInfo(cred), "scan");
        // The same command is parsed line-by-line and once more as a complete
        // result. Serialize the writes so both passes converge on one row even
        // when IndexedDB has not finished the first insert yet.
        lfUpsertQueueRef.current = lfUpsertQueueRef.current
          .catch(() => undefined)
          .then(async () => {
            const record = await upsertLfCard({ ...cred, uid }, lfMatchKey(cred));
            activeLfCardIdRef.current = record.id;
          });
      }
      const t55 = parseT55xxDetect(text);
      if (t55) {
        if (t55.chip && !t55.error) {
          if (!tagInfo || tagInfo.protocol !== "LF") {
            setIdentity({ type: t55.chip, protocol: "LF", subtype: "T55xx" }, "scan");
          } else if (!tagInfo.uid) {
            mergeIdentity({ type: t55.chip, protocol: "LF", subtype: "T55xx" }, "scan");
          }
        }
        noteLfIdentify({ ...t55, at: Date.now() });
        const activeLfCardId = activeLfCardIdRef.current;
        if (activeLfCardId && !t55.error) {
          void setLfCardMeta(activeLfCardId, {
            chip: t55.chip,
            config: t55.config,
            writable: t55.writable,
          });
        }
      }
      const magic = parseMagicInfo(text);
      if (magic) {
        noteMagicIdentify({ ...magic, at: Date.now() });
      }
    },
    [mergeIdentity, noteLfIdentify, noteMagicIdentify, setIdentity, tagInfo],
  );

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

  const upsertCachedAsset = useCallback((asset: AssetRecord) => {
    // Fire-and-forget; the useVaultAssets() live query refreshes the list.
    void putAsset(asset);
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
            void importDumpKeys(cachedDump.data, cachedDump.id);
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
      void importDumpKeys(cachedDump.data, cachedDump.id);
      const derived = tagInfoFromDump(dump);
      if (derived) mergeIdentity(derived, "dump");
    },
    [mergeIdentity, upsertCachedDump],
  );

  // The command center is created below (it needs the WASM handles), but the
  // output handler has to reach it, so it is bridged through a ref.
  const commandCenterRef = useRef<CommandCenter | null>(null);

  // WASM output handler
  const handleWasmOutput = useCallback(
    (text: string) => {
      terminalRef.current?.write(text);
      if (text) commandCenterRef.current?.noteOutputActivity();

      const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const lines = `${outputLineBufferRef.current}${normalized}`.split("\n");
      outputLineBufferRef.current = lines.pop() ?? "";
      lines.forEach((line) => {
        // Hardware output is delivered in arbitrary chunks. Parse completed
        // lines immediately, then parse the full command again at the prompt
        // so multi-line values (such as HID raw data and T55xx metadata) are
        // captured together.
        structuredOutputLinesRef.current.push(line);
        if (structuredOutputLinesRef.current.length > 2000) {
          structuredOutputLinesRef.current.splice(0, 1000);
        }
        parseTagInfo(line);
        parseWriteTargets(line);
        processGeneratedOutputLine(line);
        commandCenterRef.current?.noteOutputLine(line);
      });

      // The pm3 prompt is printed without a trailing newline, so it only ever
      // shows up as the buffered tail — and it is exactly the signal that says
      // the running command finished. Consume it here rather than waiting for a
      // newline that never comes.
      const tail = outputLineBufferRef.current;
      if (tail && isPromptLine(tail)) {
        const completedOutput = structuredOutputLinesRef.current.join("\n");
        if (completedOutput) {
          parseTagInfo(completedOutput);
          parseWriteTargets(completedOutput);
          const activeCommand = commandCenterRef.current?.activeJob?.command;
          setDeviceProfile((profile) =>
            inferDeviceProfile(profile, completedOutput, activeCommand),
          );
        }
        structuredOutputLinesRef.current = [];
        commandCenterRef.current?.noteOutputLine(tail);
        outputLineBufferRef.current = "";
      }
    },
    [parseTagInfo, parseWriteTargets, processGeneratedOutputLine],
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

  // Every command in the session goes through here, so the shell always knows
  // what is running, what is queued behind it, and how long it has been going.
  const commandCenter = useCommandCenter({
    dispatch: (command) => {
      if (wasmState.isReady) return wasmState.sendCommand(command);
      terminalRef.current?.writeln(
        wasmState.isLoading
          ? "\x1b[33mWASM client is still loading...\x1b[0m"
          : "\x1b[31mWASM client failed to load.\x1b[0m",
      );
      return null;
    },
    interrupt: wasmState.sendBreak,
    flushOutput: wasmState.flushOutput,
  });
  commandCenterRef.current = commandCenter;

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

      for (const file of Array.from(files)) {
        const base64 = await fileToBase64(file);
        const relativePath = sanitizeRelativePath(file);
        const detectionName = relativePath.split("/").pop() || file.name;
        await putAsset({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${file.name}`,
          name: file.name,
          relativePath,
          kind: detectKind(detectionName),
          size: file.size,
          base64,
          updatedAt: Date.now(),
        });
      }

      setTimeout(syncCacheToFS, 50);
    },
    [detectKind, fileToBase64, sanitizeRelativePath, syncCacheToFS],
  );

  const handleCacheDelete = useCallback((id: string) => {
    void deleteAsset(id);
  }, []);

  // Handle loading any browser-supported PM3 dump (JSON, raw Classic, EML, or MFU).
  const handleJsonUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      for (const file of Array.from(files)) {
        try {
          const imported = await importDumpFile(file);
          handleDumpLoad(imported.dump, imported.name);
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : "unsupported dump";
          terminalRef.current?.writeln(`\x1b[31mFailed to import ${file.name}: ${message}\x1b[0m`);
        }
      }
    },
    [handleDumpLoad],
  );

  // Handle command execution. Note what it deliberately no longer does: force
  // the terminal dock open. The activity bar reports the running command from
  // every workspace, so firing one never yanks the view you were using.
  const handleCommand = useCallback(
    (cmd: string) => {
      pushCommand(cmd);

      // `clear` is a client-side convenience, not a pm3 command.
      if (cmd === "clear") {
        terminalRef.current?.clear();
        return null;
      }

      return commandCenter.run(cmd);
    },
    [commandCenter, pushCommand],
  );

  // Probe once per attached hardware session. Parsing remains evidence based,
  // so future PM3 models/firmware simply enrich the profile instead of falling
  // through a hard-coded model allowlist.
  const capabilityProbeStartedRef = useRef(false);
  useEffect(() => {
    if (!wasmState.isClientAttached) {
      capabilityProbeStartedRef.current = false;
      return;
    }
    if (capabilityProbeStartedRef.current) return;
    capabilityProbeStartedRef.current = true;
    void (async () => {
      await commandCenter.runAndWait("hw version", "capability-probe");
      await commandCenter.runAndWait("hw status", "firmware-health-probe");
    })().catch((error) => {
      console.warn("Device capability probe did not complete", error);
    });
  }, [commandCenter, wasmState.isClientAttached]);

  const refreshDeviceProfile = useCallback(() => {
    setDeviceProfile(emptyDeviceProfile());
    void (async () => {
      await commandCenter.runAndWait("hw version", "capability-probe");
      await commandCenter.runAndWait("hw status", "firmware-health-probe");
    })().catch((error) => {
      console.warn("Device capability probe did not complete", error);
    });
  }, [commandCenter]);

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
      const dictionary = buildKeyDictionary(vaultKeys, uid);
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
    [handleCommand, vaultKeys, writeCacheTextFile, wasmState.isReady],
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
      localStorage.setItem(TAB_STORAGE_KEY, activeWorkspace);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TERMINAL_DOCK_STORAGE_KEY, terminalDockOpen ? "1" : "0");
    }
  }, [terminalDockOpen]);

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
      void importDumpKeys(dump.data, dump.id);
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
    setDeviceProfile(emptyDeviceProfile());
  }, [wasmState, clearTarget]);

  const handleCopyUid = useCallback(() => {
    if (tagInfo?.uid) {
      void navigator.clipboard.writeText(tagInfo.uid);
      terminalRef.current?.writeln(`\x1b[32mUID copied to clipboard: ${tagInfo.uid}\x1b[0m`);
    }
  }, [tagInfo]);

  const handleRefreshTag = useCallback(() => {
    handleCommand(tagInfo?.protocol === "LF" ? "lf search" : "hf search");
  }, [handleCommand, tagInfo?.protocol]);

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

  // Unified vault headline counts across all stores (see features/vault).
  const vaultSummary = useMemo(
    () =>
      vaultStats(cachedDumps, cachedAssets, vaultKeys, vaultCards, vaultLfCards, vaultOperations),
    [cachedDumps, cachedAssets, vaultKeys, vaultCards, vaultLfCards, vaultOperations],
  );

  // One derived description of "can this reach the hardware, and if not, where
  // is it stuck" — shared by the header chip, the activity bar and the panels.
  const connection = useMemo(
    () =>
      deriveConnectionState({
        isReady: wasmState.isReady,
        error: wasmState.error,
        isDeviceConnected: wasmState.isDeviceConnected,
        isClientAttached: wasmState.isClientAttached,
        isAttaching: wasmState.isAttaching,
        isConnecting,
        availableTransports: wasmState.availableTransports,
        activeTransportType: selectedTransport || wasmState.activeTransportType,
      }),
    [
      isConnecting,
      selectedTransport,
      wasmState.activeTransportType,
      wasmState.availableTransports,
      wasmState.error,
      wasmState.isAttaching,
      wasmState.isClientAttached,
      wasmState.isDeviceConnected,
      wasmState.isReady,
    ],
  );

  // Persist each terminal job once it reaches a terminal state. The job id is
  // the database primary key, making this safe if React effects replay in dev.
  const persistedJobsRef = useRef(new Set<string>());
  useEffect(() => {
    for (const job of commandCenter.jobs) {
      if (!job.endedAt || persistedJobsRef.current.has(job.id)) continue;
      persistedJobsRef.current.add(job.id);
      void putOperation(
        operationFromJob(job, {
          targetUid: cardTarget.target.uid,
          targetType: cardTarget.target.identity?.type,
          transport: connection.transportLabel,
        }),
      );
    }
  }, [
    cardTarget.target.identity?.type,
    cardTarget.target.uid,
    commandCenter.jobs,
    connection.transportLabel,
  ]);

  const deviceProfileContext = useMemo(
    () => ({
      profile: deviceProfile,
      resetProfile: () => setDeviceProfile(emptyDeviceProfile()),
      refreshProfile: refreshDeviceProfile,
    }),
    [deviceProfile, refreshDeviceProfile],
  );

  const hasHardwareTransport = connection.hasHardwareTransport;
  const activeTransportLabel = connection.transportLabel;
  // On the Session workspace the terminal *is* the layout, so there is nothing
  // to dock or undock.
  const isSessionWorkspace = getWorkspace(activeWorkspace).value === DEFAULT_WORKSPACE;

  return (
    <DeviceProfileContext.Provider value={deviceProfileContext}>
      <CardTargetContext.Provider value={cardTarget}>
        <CommandCenterContext.Provider value={commandCenter}>
          <div className="h-dvh overflow-hidden flex flex-col bg-background">
            {/* Ribbon Toolbar */}
            <RibbonToolbar
              connection={connection}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onCommand={handleCommand}
              onStopOperation={commandCenter.stopActive}
              onHardReset={wasmState.hardReset}
              theme={theme}
              onThemeChange={setTheme}
              isBusy={commandCenter.isBusy}
              cacheItems={cachedAssets}
              cacheSyncing={isSyncingCache}
              onCacheUpload={handleCacheUpload}
              onCacheUse={handleCacheUse}
              onCacheDelete={handleCacheDelete}
              onCacheSync={syncCacheToFS}
              cachePathPrefix={CACHE_PATH_PREFIX}
              activeWorkspace={activeWorkspace}
              onWorkspaceChange={openWorkspace}
              activeStrip={activeStrip}
              onStripChange={setActiveStrip}
              availableTransports={wasmState.availableTransports}
              selectedTransport={selectedTransport || wasmState.activeTransportType}
              onTransportChange={setSelectedTransport}
              onJsonUpload={handleJsonUpload}
            />
            <MainPanelRouter
              activeWorkspace={activeWorkspace}
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
              onOpenTab={openWorkspace}
              onLoadSample={() =>
                handleDumpLoad(PRIMARY_SAMPLE_DUMP.data, PRIMARY_SAMPLE_DUMP.name)
              }
              onRefreshTag={handleRefreshTag}
              onDumpLoad={handleDumpLoad}
              onDumpRename={handleDumpRename}
              onDumpDelete={handleDumpDelete}
              onClearCache={() => void clearAssets()}
              activeTransportType={wasmState.activeTransportType}
              onDisconnectApplication={wasmState.disconnectDevice}
              onReconnectApplication={() => wasmState.connectDevice("webserial")}
              onFirmwareLog={writeTerminalLine}
            />

            {/* Activity bar: connection, the running command and the terminal
            toggle, present on every workspace. */}
            <ActivityBar
              connection={connection}
              vault={vaultSummary}
              terminalOpen={terminalDockOpen}
              onToggleTerminal={
                isSessionWorkspace ? undefined : () => setTerminalDockOpen((open) => !open)
              }
              onCommand={handleCommand}
              onOpenTab={openWorkspace}
              onRefresh={handleRefreshTag}
              onCopyUid={handleCopyUid}
              disabled={!canRunCommands}
            />
          </div>
        </CommandCenterContext.Provider>
      </CardTargetContext.Provider>
    </DeviceProfileContext.Provider>
  );
}

export default App;
