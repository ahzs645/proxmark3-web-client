import type { RefObject } from "react";
import type { TerminalHandle } from "@/components/terminal/Terminal";
import { SidebarPane } from "./SidebarPane";
import { SessionDashboard } from "./SessionDashboard";
import { TerminalPane } from "./TerminalPane";
import type { LibraryKeyMode } from "@/features/keys/libraryKeyCommands";

interface WorkbenchHomeProps {
  terminalRef: RefObject<TerminalHandle | null>;
  /** When a main panel is open, collapse to a terminal-only dock (dashboard + sidebar hidden). */
  panelOpen?: boolean;
  /** Collapse the terminal dock (only meaningful while panelOpen). */
  onCollapseTerminal?: () => void;
  canRunCommands: boolean;
  isLoading: boolean;
  isConnecting: boolean;
  isDeviceConnected: boolean;
  hasHardwareTransport: boolean;
  activeTransportLabel: string;
  activeDumpName?: string;
  cacheCount: number;
  dumpCount: number;
  commandHistory: string[];
  quickCommand: string;
  onQuickCommandChange: (value: string) => void;
  onRunQuickCommand: () => void;
  onCommand: (cmd: string) => void;
  onInput: (char: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onCopyUid: () => void;
  onOpenTab: (tab: string) => void;
  onLoadSample: () => void;
  onRefreshTag: () => void;
  libraryKeyMode: LibraryKeyMode;
  onLibraryKeyModeChange: (mode: LibraryKeyMode) => void;
}

export function WorkbenchHome({
  terminalRef,
  panelOpen = false,
  onCollapseTerminal,
  canRunCommands,
  isLoading,
  isConnecting,
  isDeviceConnected,
  hasHardwareTransport,
  activeTransportLabel,
  activeDumpName,
  cacheCount,
  dumpCount,
  commandHistory,
  quickCommand,
  onQuickCommandChange,
  onRunQuickCommand,
  onCommand,
  onInput,
  onConnect,
  onDisconnect,
  onCopyUid,
  onOpenTab,
  onLoadSample,
  onRefreshTag,
  libraryKeyMode,
  onLibraryKeyModeChange,
}: WorkbenchHomeProps) {
  return (
    <div
      className={
        panelOpen
          ? "flex flex-1 flex-col overflow-hidden p-2 pt-0"
          : // Below md the dashboard, terminal and sidebar cannot all fit a
            // viewport, so the page scrolls instead of clipping them onto
            // each other.
            "flex flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-4 md:overflow-hidden"
      }
    >
      {panelOpen ? null : (
        <SessionDashboard
          isLoading={isLoading}
          canRunCommands={canRunCommands}
          isConnecting={isConnecting}
          isDeviceConnected={isDeviceConnected}
          hasHardwareTransport={hasHardwareTransport}
          activeTransportLabel={activeTransportLabel}
          activeDumpName={activeDumpName}
          cacheCount={cacheCount}
          dumpCount={dumpCount}
          commandCount={commandHistory.length}
          onToggleConnection={() => {
            if (isDeviceConnected) {
              onDisconnect();
            } else {
              onConnect();
            }
          }}
          onOpenTab={onOpenTab}
          onLoadSample={onLoadSample}
          onRunHfSearch={() => onCommand("hf search")}
        />
      )}

      <div
        className={
          panelOpen
            ? "flex min-h-0 flex-1"
            : "grid grid-cols-1 gap-4 md:min-h-0 md:flex-1 md:grid-cols-[320px_minmax(0,1fr)]"
        }
      >
        <div
          className={
            panelOpen
              ? "flex min-h-0 min-w-0 flex-1 flex-col gap-3"
              : "order-2 flex min-h-[22rem] min-w-0 flex-col gap-3 md:order-2 md:min-h-0"
          }
        >
          <TerminalPane
            terminalRef={terminalRef}
            canRunCommands={canRunCommands}
            isLoading={isLoading}
            isDeviceConnected={isDeviceConnected}
            quickCommand={quickCommand}
            onQuickCommandChange={onQuickCommandChange}
            onRunQuickCommand={onRunQuickCommand}
            onCommand={onCommand}
            onInput={onInput}
            libraryKeyMode={libraryKeyMode}
            onLibraryKeyModeChange={onLibraryKeyModeChange}
            onCollapse={panelOpen ? onCollapseTerminal : undefined}
          />
        </div>

        {panelOpen ? null : (
          <SidebarPane
            canRunCommands={canRunCommands}
            commandHistory={commandHistory}
            isDeviceConnected={isDeviceConnected}
            hasHardwareTransport={hasHardwareTransport}
            onCommand={onCommand}
            onConnect={onConnect}
            onCopyUid={onCopyUid}
            onOpenTab={onOpenTab}
            onRefreshTag={onRefreshTag}
            libraryKeyMode={libraryKeyMode}
            onLibraryKeyModeChange={onLibraryKeyModeChange}
          />
        )}
      </div>
    </div>
  );
}
