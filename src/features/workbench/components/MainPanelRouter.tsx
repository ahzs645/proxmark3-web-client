import { lazy, Suspense } from "react";
import { ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Theme } from "@/hooks/useTheme";
import type { CachedDump, PM3DumpJson } from "@/components/panels/CardMemoryMap";
import { WorkbenchHome } from "./WorkbenchHome";
import type { CachedAssetWithData } from "../types";
import type { TerminalHandle } from "@/components/terminal/Terminal";
import type { RefObject } from "react";

const CardMemoryMap = lazy(() =>
  import("@/components/panels/CardMemoryMap").then((m) => ({ default: m.CardMemoryMap })),
);
const HexAsciiViewer = lazy(() =>
  import("@/components/panels/HexAsciiViewer").then((m) => ({ default: m.HexAsciiViewer })),
);
const MifareAttacksPanel = lazy(() =>
  import("@/components/panels/MifareAttacksPanel").then((m) => ({
    default: m.MifareAttacksPanel,
  })),
);
const MagicCardPanel = lazy(() =>
  import("@/components/panels/MagicCardPanel").then((m) => ({ default: m.MagicCardPanel })),
);
const LFOperationsPanel = lazy(() =>
  import("@/components/panels/LFOperationsPanel").then((m) => ({
    default: m.LFOperationsPanel,
  })),
);
const T55xxPanel = lazy(() =>
  import("@/components/panels/T55xxPanel").then((m) => ({ default: m.T55xxPanel })),
);
const TrafficCapturePanel = lazy(() =>
  import("@/components/panels/TrafficCapturePanel").then((m) => ({
    default: m.TrafficCapturePanel,
  })),
);
const SettingsPanel = lazy(() =>
  import("@/components/panels/SettingsPanel").then((m) => ({ default: m.SettingsPanel })),
);
const LibraryPanel = lazy(() =>
  import("@/components/panels/LibraryPanel").then((m) => ({ default: m.LibraryPanel })),
);
const UtilitiesPanel = lazy(() =>
  import("@/components/panels/UtilitiesPanel").then((m) => ({ default: m.UtilitiesPanel })),
);

function PanelLoading() {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading panel…
    </div>
  );
}

interface MainPanelRouterProps {
  activeTab: string;
  terminalDockOpen: boolean;
  onTerminalDockToggle: () => void;
  onDumpWithSavedKeys: (uid: string, cardType: "1k" | "4k") => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  terminalRef: RefObject<TerminalHandle | null>;
  activeDump: CachedDump | null;
  cachedDumps: CachedDump[];
  cachedAssets: CachedAssetWithData[];
  cachePathPrefix: string;
  canRunCommands: boolean;
  isLoading: boolean;
  isConnecting: boolean;
  isDeviceConnected: boolean;
  hasHardwareTransport: boolean;
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
  onOpenTab: (tab: string) => void;
  onLoadSample: () => void;
  onRefreshTag: () => void;
  onDumpLoad: (dump: PM3DumpJson, name: string) => void;
  onDumpRename: (id: string, newName: string) => void;
  onDumpDelete: (id: string) => void;
  onClearCache: () => void;
}

export function MainPanelRouter({
  activeTab,
  terminalDockOpen,
  onTerminalDockToggle,
  onDumpWithSavedKeys,
  theme,
  onThemeChange,
  terminalRef,
  activeDump,
  cachedDumps,
  cachedAssets,
  cachePathPrefix,
  canRunCommands,
  isLoading,
  isConnecting,
  isDeviceConnected,
  hasHardwareTransport,
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
  onOpenTab,
  onLoadSample,
  onRefreshTag,
  onDumpLoad,
  onDumpRename,
  onDumpDelete,
  onClearCache,
}: MainPanelRouterProps) {
  let panel = null;

  if (activeTab === "memory") {
    panel = (
      <div className="flex-1 flex flex-col overflow-hidden p-4">
        <CardMemoryMap
          onCommand={onCommand}
          onDumpWithSavedKeys={onDumpWithSavedKeys}
          disabled={!canRunCommands}
          cachedDumps={cachedDumps}
          onDumpLoad={onDumpLoad}
          onDumpRename={onDumpRename}
          onDumpDelete={onDumpDelete}
          activeDump={activeDump}
        />
      </div>
    );
  } else if (activeTab === "hex") {
    panel = (
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto">
          <HexAsciiViewer dumps={cachedAssets} />
        </div>
      </div>
    );
  } else if (activeTab === "attacks") {
    panel = (
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
  } else if (activeTab === "magic") {
    panel = (
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full max-w-2xl mx-auto">
          <MagicCardPanel onCommand={onCommand} disabled={!canRunCommands} />
        </div>
      </div>
    );
  } else if (activeTab === "lfops") {
    panel = (
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full max-w-2xl mx-auto">
          <LFOperationsPanel onCommand={onCommand} disabled={!canRunCommands} />
        </div>
      </div>
    );
  } else if (activeTab === "t55xx") {
    panel = (
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full max-w-2xl mx-auto">
          <T55xxPanel onCommand={onCommand} disabled={!canRunCommands} />
        </div>
      </div>
    );
  } else if (activeTab === "traffic") {
    panel = (
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto">
          <TrafficCapturePanel onCommand={onCommand} disabled={!canRunCommands} />
        </div>
      </div>
    );
  } else if (activeTab === "library") {
    panel = (
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full max-w-5xl mx-auto">
          <LibraryPanel
            activeDump={activeDump}
            cachedDumps={cachedDumps}
            onDumpLoad={onDumpLoad}
            onDumpRename={onDumpRename}
            onDumpDelete={onDumpDelete}
          />
        </div>
      </div>
    );
  } else if (activeTab === "utilities") {
    panel = (
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full max-w-5xl mx-auto">
          <UtilitiesPanel />
        </div>
      </div>
    );
  } else if (activeTab === "settings") {
    panel = (
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Active panel sits on top; the terminal dock below shows live output. */}
      {panel ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Suspense fallback={<PanelLoading />}>{panel}</Suspense>
        </div>
      ) : null}

      {/* Keep the workbench (and its terminal) mounted while a panel is open so
          terminal scrollback and live WASM output survive tab switches. Under a
          panel it becomes a terminal dock; when the dock is hidden it stays
          mounted (display:none) so streaming output is never lost. */}
      <div
        className={cn(
          "flex min-h-0 flex-col",
          !panel && "flex-1",
          panel && terminalDockOpen && "shrink-0 basis-[45%] border-t border-border",
          panel && !terminalDockOpen && "hidden",
        )}
      >
        <WorkbenchHome
          terminalRef={terminalRef}
          panelOpen={!!panel}
          onCollapseTerminal={panel ? onTerminalDockToggle : undefined}
          canRunCommands={canRunCommands}
          isLoading={isLoading}
          isConnecting={isConnecting}
          isDeviceConnected={isDeviceConnected}
          hasHardwareTransport={hasHardwareTransport}
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
          onOpenTab={onOpenTab}
          onLoadSample={onLoadSample}
          onRefreshTag={onRefreshTag}
        />
      </div>

      {/* When the dock is hidden under a panel, offer a slim reopen affordance. */}
      {panel && !terminalDockOpen ? (
        <button
          type="button"
          onClick={onTerminalDockToggle}
          className="flex shrink-0 items-center justify-center gap-1.5 border-t border-border bg-card/60 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronUp className="h-3 w-3" />
          Show terminal
        </button>
      ) : null}
    </div>
  );
}
