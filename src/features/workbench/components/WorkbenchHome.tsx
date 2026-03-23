import type { RefObject } from "react";
import type { TerminalHandle } from "@/components/terminal/Terminal";
import { SidebarPane } from "./SidebarPane";
import { SessionDashboard } from "./SessionDashboard";
import { TerminalPane } from "./TerminalPane";
import type { TagInfo } from "@/components/panels/TagInfoPanel";

interface WorkbenchHomeProps {
  terminalRef: RefObject<TerminalHandle | null>;
  tagInfo: TagInfo | null;
  canRunCommands: boolean;
  isLoading: boolean;
  isDeviceConnected: boolean;
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
  onRefreshTag: () => void;
}

export function WorkbenchHome({
  terminalRef,
  tagInfo,
  canRunCommands,
  isLoading,
  isDeviceConnected,
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
  onRefreshTag,
}: WorkbenchHomeProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
      <SessionDashboard
        isLoading={isLoading}
        canRunCommands={canRunCommands}
        isDeviceConnected={isDeviceConnected}
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
        onRunHfSearch={() => onCommand("hf search")}
      />

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
        <div className="order-1 flex min-h-0 min-w-0 flex-col gap-3 md:order-2">
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

        <SidebarPane
          tagInfo={tagInfo}
          canRunCommands={canRunCommands}
          commandHistory={commandHistory}
          isDeviceConnected={isDeviceConnected}
          onCommand={onCommand}
          onConnect={onConnect}
          onCopyUid={onCopyUid}
          onOpenMemory={onOpenMemory}
          onRefreshTag={onRefreshTag}
        />
      </div>
    </div>
  );
}
