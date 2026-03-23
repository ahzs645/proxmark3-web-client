import type { Theme } from "@/hooks/useTheme";
import { HexAsciiViewer } from "@/components/panels/HexAsciiViewer";
import {
  CardMemoryMap,
  type CachedDump,
  type PM3DumpJson,
} from "@/components/panels/CardMemoryMap";
import { MifareAttacksPanel } from "@/components/panels/MifareAttacksPanel";
import { MagicCardPanel } from "@/components/panels/MagicCardPanel";
import { LFOperationsPanel } from "@/components/panels/LFOperationsPanel";
import { T55xxPanel } from "@/components/panels/T55xxPanel";
import { TrafficCapturePanel } from "@/components/panels/TrafficCapturePanel";
import { SettingsPanel } from "@/components/panels/SettingsPanel";
import { LibraryPanel } from "@/components/panels/LibraryPanel";
import { UtilitiesPanel } from "@/components/panels/UtilitiesPanel";
import { WorkbenchHome } from "./WorkbenchHome";
import type { CachedAssetWithData } from "../types";
import type { TerminalHandle } from "@/components/terminal/Terminal";
import type { RefObject } from "react";
import type { TagInfo } from "@/components/panels/TagInfoPanel";

interface MainPanelRouterProps {
  activeTab: string;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  terminalRef: RefObject<TerminalHandle | null>;
  tagInfo: TagInfo | null;
  activeDump: CachedDump | null;
  cachedDumps: CachedDump[];
  cachedAssets: CachedAssetWithData[];
  cachePathPrefix: string;
  canRunCommands: boolean;
  isLoading: boolean;
  isDeviceConnected: boolean;
  activeTransportLabel: string;
  commandHistory: string[];
  quickCommand: string;
  onQuickCommandChange: (value: string) => void;
  onRunQuickCommand: () => void;
  onCommand: (cmd: string) => void;
  onInput: (char: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onCopyUid: () => void;
  onOpenMemory: () => void;
  onOpenShortcuts: () => void;
  onRefreshTag: () => void;
  onDumpLoad: (dump: PM3DumpJson, name: string) => void;
  onDumpRename: (id: string, newName: string) => void;
  onDumpDelete: (id: string) => void;
  onClearCache: () => void;
}

export function MainPanelRouter({
  activeTab,
  theme,
  onThemeChange,
  terminalRef,
  tagInfo,
  activeDump,
  cachedDumps,
  cachedAssets,
  cachePathPrefix,
  canRunCommands,
  isLoading,
  isDeviceConnected,
  activeTransportLabel,
  commandHistory,
  quickCommand,
  onQuickCommandChange,
  onRunQuickCommand,
  onCommand,
  onInput,
  onConnect,
  onDisconnect,
  onCopyUid,
  onOpenMemory,
  onOpenShortcuts,
  onRefreshTag,
  onDumpLoad,
  onDumpRename,
  onDumpDelete,
  onClearCache,
}: MainPanelRouterProps) {
  if (activeTab === "memory") {
    return (
      <div className="flex-1 flex flex-col overflow-hidden p-4">
        <CardMemoryMap
          onCommand={onCommand}
          disabled={!canRunCommands}
          cachedDumps={cachedDumps}
          onDumpLoad={onDumpLoad}
          onDumpRename={onDumpRename}
          onDumpDelete={onDumpDelete}
          activeDump={activeDump}
        />
      </div>
    );
  }

  if (activeTab === "hex") {
    return (
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto">
          <HexAsciiViewer dumps={cachedAssets} />
        </div>
      </div>
    );
  }

  if (activeTab === "attacks") {
    return (
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full max-w-2xl mx-auto">
          <MifareAttacksPanel
            onCommand={onCommand}
            disabled={!canRunCommands}
            cachedAssets={cachedAssets}
            cachePathPrefix={cachePathPrefix}
          />
        </div>
      </div>
    );
  }

  if (activeTab === "magic") {
    return (
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full max-w-2xl mx-auto">
          <MagicCardPanel
            onCommand={onCommand}
            disabled={!canRunCommands}
            currentUid={tagInfo?.uid?.replace(/:/g, "")}
            currentAtqa={tagInfo?.atqa?.replace(/\s/g, "")}
            currentSak={tagInfo?.sak}
          />
        </div>
      </div>
    );
  }

  if (activeTab === "lfops") {
    return (
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full max-w-2xl mx-auto">
          <LFOperationsPanel onCommand={onCommand} disabled={!canRunCommands} />
        </div>
      </div>
    );
  }

  if (activeTab === "t55xx") {
    return (
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full max-w-2xl mx-auto">
          <T55xxPanel onCommand={onCommand} disabled={!canRunCommands} />
        </div>
      </div>
    );
  }

  if (activeTab === "traffic") {
    return (
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto">
          <TrafficCapturePanel onCommand={onCommand} disabled={!canRunCommands} />
        </div>
      </div>
    );
  }

  if (activeTab === "library") {
    return (
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full max-w-5xl mx-auto">
          <LibraryPanel
            currentTag={tagInfo}
            activeDump={activeDump}
            cachedDumps={cachedDumps}
            onDumpLoad={onDumpLoad}
            onDumpRename={onDumpRename}
            onDumpDelete={onDumpDelete}
          />
        </div>
      </div>
    );
  }

  if (activeTab === "utilities") {
    return (
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full max-w-5xl mx-auto">
          <UtilitiesPanel />
        </div>
      </div>
    );
  }

  if (activeTab === "settings") {
    return (
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full max-w-xl mx-auto">
          <SettingsPanel
            theme={theme}
            onThemeChange={onThemeChange}
            cacheCount={cachedAssets.length}
            onClearCache={onClearCache}
          />
        </div>
      </div>
    );
  }

  return (
    <WorkbenchHome
      terminalRef={terminalRef}
      tagInfo={tagInfo}
      canRunCommands={canRunCommands}
      isLoading={isLoading}
      isDeviceConnected={isDeviceConnected}
      activeTransportLabel={activeTransportLabel}
      activeDumpName={activeDump?.name}
      cacheCount={cachedAssets.length}
      dumpCount={cachedDumps.length}
      commandHistory={commandHistory}
      quickCommand={quickCommand}
      onQuickCommandChange={onQuickCommandChange}
      onRunQuickCommand={onRunQuickCommand}
      onCommand={onCommand}
      onInput={onInput}
      onConnect={onConnect}
      onDisconnect={onDisconnect}
      onCopyUid={onCopyUid}
      onOpenMemory={onOpenMemory}
      onOpenShortcuts={onOpenShortcuts}
      onRefreshTag={onRefreshTag}
    />
  );
}
