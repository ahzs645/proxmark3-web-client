import type { RefObject } from "react";
import type { TerminalHandle } from "@/components/terminal/Terminal";
import { SidebarPane } from "./SidebarPane";
import { SessionDashboard } from "./SessionDashboard";
import { TerminalPane } from "./TerminalPane";
import type { TagInfo } from "@/components/panels/TagInfoPanel";

interface WorkbenchHomeProps {
  terminalRef: RefObject<TerminalHandle | null>;
  /** When a main panel is open, collapse to a terminal-only dock (dashboard + sidebar hidden). */
  panelOpen?: boolean;
  tagInfo: TagInfo | null;
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
  onOpenMemory: () => void;
  onOpenShortcuts: () => void;
  onOpenTab: (tab: string) => void;
  onLoadSample: () => void;
  onRefreshTag: () => void;
}

export function WorkbenchHome({
  terminalRef,
  panelOpen = false,
  tagInfo,
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
  onOpenMemory,
  onOpenShortcuts,
  onOpenTab,
  onLoadSample,
  onRefreshTag,
}: WorkbenchHomeProps) {
  return (
    <div
      className={
        panelOpen
          ? "flex flex-1 flex-col overflow-hidden p-2 pt-0"
          : "flex flex-1 flex-col gap-4 overflow-hidden p-4"
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
          onOpenMemory={onOpenMemory}
          onOpenShortcuts={onOpenShortcuts}
          onOpenTab={onOpenTab}
          onLoadSample={onLoadSample}
          onRunHfSearch={() => onCommand("hf search")}
        />
      )}

      <div
        className={
          panelOpen
            ? "flex min-h-0 flex-1"
            : "grid flex-1 min-h-0 grid-cols-1 gap-4 md:grid-cols-[320px_minmax(0,1fr)]"
        }
      >
        <div
          className={
            panelOpen
              ? "flex min-h-0 min-w-0 flex-1 flex-col gap-3"
              : "order-2 flex min-h-0 min-w-0 flex-col gap-3 md:order-2"
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
          />
        </div>

        {panelOpen ? null : (
          <SidebarPane
            tagInfo={tagInfo}
            canRunCommands={canRunCommands}
            commandHistory={commandHistory}
            isDeviceConnected={isDeviceConnected}
            hasHardwareTransport={hasHardwareTransport}
            onCommand={onCommand}
            onConnect={onConnect}
            onCopyUid={onCopyUid}
            onOpenMemory={onOpenMemory}
            onRefreshTag={onRefreshTag}
          />
        )}
      </div>
    </div>
  );
}
