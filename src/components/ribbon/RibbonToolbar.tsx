import { RibbonStripPicker, RibbonTabNav } from "@/features/ribbon/RibbonTabNav";
import { getWorkspace, type RibbonStripId } from "@/features/ribbon/config";
import { useRibbonSelections } from "@/features/ribbon/hooks/useRibbonSelections";
import type { RibbonToolbarProps } from "@/features/ribbon/types";
import { ActionsTab } from "@/features/ribbon/tabs/ActionsTab";
import { AttacksTab } from "@/features/ribbon/tabs/AttacksTab";
import { ConnectTab } from "@/features/ribbon/tabs/ConnectTab";
import { DataTab } from "@/features/ribbon/tabs/DataTab";
import { HFTab } from "@/features/ribbon/tabs/HFTab";
import { HexTab } from "@/features/ribbon/tabs/HexTab";
import { LibraryTab } from "@/features/ribbon/tabs/LibraryTab";
import { LFOpsTab } from "@/features/ribbon/tabs/LFOpsTab";
import { LFTab } from "@/features/ribbon/tabs/LFTab";
import { MagicTab } from "@/features/ribbon/tabs/MagicTab";
import { MemoryTab } from "@/features/ribbon/tabs/MemoryTab";
import { SettingsTab } from "@/features/ribbon/tabs/SettingsTab";
import { T55xxTab } from "@/features/ribbon/tabs/T55xxTab";
import { ToolsTab } from "@/features/ribbon/tabs/ToolsTab";
import { TrafficTab } from "@/features/ribbon/tabs/TrafficTab";
import { UtilitiesTab } from "@/features/ribbon/tabs/UtilitiesTab";
import { toLegacyStatus } from "@/features/connection/model";

/**
 * Header of the workbench: the workspace switcher on top, and below it the
 * command strip for whichever strip the workspace has selected. Switching
 * strips never navigates, so commands can be fired from here without losing
 * the panel you are working in.
 */
export function RibbonToolbar({
  connection,
  onConnect,
  onDisconnect,
  onCommand,
  onStopOperation,
  onHardReset,
  theme,
  onThemeChange,
  isBusy,
  cacheItems,
  cacheSyncing,
  onCacheUpload,
  onCacheUse,
  onCacheDelete,
  onCacheSync,
  cachePathPrefix,
  activeWorkspace,
  onWorkspaceChange,
  activeStrip,
  onStripChange,
  onJsonUpload,
  availableTransports = [],
  selectedTransport = null,
  onTransportChange,
}: RibbonToolbarProps) {
  const commandsEnabled = connection.canRunCommands;
  const workspace = getWorkspace(activeWorkspace);
  const { selectedLFCardType, setSelectedLFCardType, selectedHFCardType, setSelectedHFCardType } =
    useRibbonSelections();

  return (
    <div className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <RibbonTabNav
        connection={connection}
        activeWorkspace={activeWorkspace}
        onWorkspaceChange={onWorkspaceChange}
        theme={theme}
        onThemeChange={onThemeChange}
        onStopOperation={onStopOperation}
        onHardReset={onHardReset}
        commandsEnabled={commandsEnabled}
        isBusy={isBusy}
      />

      <div className="ribbon-tab-content flex items-stretch gap-2 p-2">
        <RibbonStripPicker
          strips={workspace.strips}
          activeStrip={activeStrip}
          onStripChange={onStripChange}
        />
        <div className="min-w-0 flex-1">
          {renderStrip(activeStrip, {
            connectionStatus: toLegacyStatus(connection),
            onConnect,
            onDisconnect,
            onCommand,
            commandsEnabled,
            availableTransports,
            selectedTransport,
            onTransportChange,
            cacheItems,
            cacheSyncing,
            onCacheUpload,
            onCacheUse,
            onCacheDelete,
            onCacheSync,
            cachePathPrefix,
            onJsonUpload,
            onWorkspaceChange,
            selectedHFCardType,
            onSelectedHFCardTypeChange: setSelectedHFCardType,
            selectedLFCardType,
            onSelectedLFCardTypeChange: setSelectedLFCardType,
          })}
        </div>
      </div>
    </div>
  );
}

type StripContext = {
  connectionStatus: ReturnType<typeof toLegacyStatus>;
  onConnect: RibbonToolbarProps["onConnect"];
  onDisconnect: RibbonToolbarProps["onDisconnect"];
  onCommand: RibbonToolbarProps["onCommand"];
  commandsEnabled: boolean;
  availableTransports: NonNullable<RibbonToolbarProps["availableTransports"]>;
  selectedTransport: RibbonToolbarProps["selectedTransport"];
  onTransportChange: RibbonToolbarProps["onTransportChange"];
  cacheItems: RibbonToolbarProps["cacheItems"];
  cacheSyncing: RibbonToolbarProps["cacheSyncing"];
  onCacheUpload: RibbonToolbarProps["onCacheUpload"];
  onCacheUse: RibbonToolbarProps["onCacheUse"];
  onCacheDelete: RibbonToolbarProps["onCacheDelete"];
  onCacheSync: RibbonToolbarProps["onCacheSync"];
  cachePathPrefix: RibbonToolbarProps["cachePathPrefix"];
  onJsonUpload: RibbonToolbarProps["onJsonUpload"];
  onWorkspaceChange: RibbonToolbarProps["onWorkspaceChange"];
  selectedHFCardType: string;
  onSelectedHFCardTypeChange: (value: string) => void;
  selectedLFCardType: string;
  onSelectedLFCardTypeChange: (value: string) => void;
};

function renderStrip(strip: RibbonStripId, ctx: StripContext) {
  switch (strip) {
    case "connect":
      return (
        <ConnectTab
          connectionStatus={ctx.connectionStatus}
          onConnect={ctx.onConnect}
          onDisconnect={ctx.onDisconnect}
          onCommand={ctx.onCommand}
          commandsEnabled={ctx.commandsEnabled}
          availableTransports={ctx.availableTransports}
          selectedTransport={ctx.selectedTransport}
          onTransportChange={ctx.onTransportChange}
        />
      );
    case "hf":
      return (
        <HFTab
          commandsEnabled={ctx.commandsEnabled}
          onCommand={ctx.onCommand}
          selectedHFCardType={ctx.selectedHFCardType}
          onSelectedHFCardTypeChange={ctx.onSelectedHFCardTypeChange}
        />
      );
    case "lf":
      return (
        <LFTab
          commandsEnabled={ctx.commandsEnabled}
          onCommand={ctx.onCommand}
          selectedLFCardType={ctx.selectedLFCardType}
          onSelectedLFCardTypeChange={ctx.onSelectedLFCardTypeChange}
        />
      );
    case "data":
      return <DataTab commandsEnabled={ctx.commandsEnabled} onCommand={ctx.onCommand} />;
    case "tools":
      return <ToolsTab commandsEnabled={ctx.commandsEnabled} onCommand={ctx.onCommand} />;
    case "shortcuts":
      return (
        <ActionsTab
          canRunCommands={ctx.commandsEnabled}
          cacheItems={ctx.cacheItems}
          cacheSyncing={ctx.cacheSyncing}
          onCacheUpload={ctx.onCacheUpload}
          onCacheUse={ctx.onCacheUse}
          onCacheDelete={ctx.onCacheDelete}
          onCacheSync={ctx.onCacheSync}
          cachePathPrefix={ctx.cachePathPrefix}
          onCommand={ctx.onCommand}
        />
      );
    case "memory":
      return (
        <MemoryTab
          commandsEnabled={ctx.commandsEnabled}
          cacheItemsLength={ctx.cacheItems.length}
          cacheSyncing={ctx.cacheSyncing}
          onCommand={ctx.onCommand}
          onJsonUpload={ctx.onJsonUpload}
          onCacheUpload={ctx.onCacheUpload}
          onCacheSync={ctx.onCacheSync}
        />
      );
    case "hex":
      return (
        <HexTab
          cacheItemsLength={ctx.cacheItems.length}
          cacheSyncing={ctx.cacheSyncing}
          onCacheUpload={ctx.onCacheUpload}
          onCacheSync={ctx.onCacheSync}
        />
      );
    case "library":
      return <LibraryTab onCommand={ctx.onCommand} commandsEnabled={ctx.commandsEnabled} />;
    case "utilities":
      return <UtilitiesTab onWorkspaceChange={ctx.onWorkspaceChange} />;
    case "attacks":
      return <AttacksTab commandsEnabled={ctx.commandsEnabled} onCommand={ctx.onCommand} />;
    case "magic":
      return <MagicTab commandsEnabled={ctx.commandsEnabled} onCommand={ctx.onCommand} />;
    case "traffic":
      return <TrafficTab commandsEnabled={ctx.commandsEnabled} onCommand={ctx.onCommand} />;
    case "lfops":
      return <LFOpsTab commandsEnabled={ctx.commandsEnabled} onCommand={ctx.onCommand} />;
    case "t55xx":
      return <T55xxTab commandsEnabled={ctx.commandsEnabled} onCommand={ctx.onCommand} />;
    case "settings":
      return <SettingsTab />;
    default:
      return null;
  }
}

export default RibbonToolbar;
