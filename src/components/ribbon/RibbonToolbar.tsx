import { Tabs, TabsContent } from "@/components/ui/tabs";
import { getTransportLabel } from "@/lib/transports";
import { RibbonTabNav } from "@/features/ribbon/RibbonTabNav";
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

export function RibbonToolbar({
  connectionStatus,
  onConnect,
  onDisconnect,
  onCommand,
  onStopOperation,
  onHardReset,
  theme,
  onThemeChange,
  canRunCommands = false,
  cacheItems,
  cacheSyncing,
  onCacheUpload,
  onCacheUse,
  onCacheDelete,
  onCacheSync,
  cachePathPrefix,
  activeTab,
  onTabChange,
  onJsonUpload,
  availableTransports = [],
  selectedTransport = null,
  onTransportChange,
}: RibbonToolbarProps) {
  const commandsEnabled = canRunCommands;
  const activeTransport = selectedTransport || availableTransports[0]?.type || null;
  const activeTransportLabel = getTransportLabel(activeTransport, availableTransports);
  const { selectedLFCardType, setSelectedLFCardType, selectedHFCardType, setSelectedHFCardType } =
    useRibbonSelections();

  return (
    <div className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <RibbonTabNav
          connectionStatus={connectionStatus}
          activeTransportLabel={activeTransportLabel}
          theme={theme}
          onThemeChange={onThemeChange}
          onStopOperation={onStopOperation}
          onHardReset={onHardReset}
          commandsEnabled={commandsEnabled}
        />

        <TabsContent value="connect" className="m-0 p-2 ribbon-tab-content">
          <ConnectTab
            connectionStatus={connectionStatus}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onCommand={onCommand}
            commandsEnabled={commandsEnabled}
            availableTransports={availableTransports}
            selectedTransport={selectedTransport}
            onTransportChange={onTransportChange}
          />
        </TabsContent>

        <TabsContent value="hf" className="m-0 p-2 ribbon-tab-content">
          <HFTab
            commandsEnabled={commandsEnabled}
            selectedHFCardType={selectedHFCardType}
            onSelectedHFCardTypeChange={setSelectedHFCardType}
            onCommand={onCommand}
          />
        </TabsContent>

        <TabsContent value="lf" className="m-0 p-2 ribbon-tab-content">
          <LFTab
            commandsEnabled={commandsEnabled}
            selectedLFCardType={selectedLFCardType}
            onSelectedLFCardTypeChange={setSelectedLFCardType}
            onCommand={onCommand}
          />
        </TabsContent>

        <TabsContent value="data" className="m-0 p-2 ribbon-tab-content">
          <DataTab commandsEnabled={commandsEnabled} onCommand={onCommand} />
        </TabsContent>

        <TabsContent value="tools" className="m-0 p-2 ribbon-tab-content">
          <ToolsTab commandsEnabled={commandsEnabled} onCommand={onCommand} />
        </TabsContent>

        <TabsContent value="actions" className="m-0 p-2 ribbon-tab-content">
          <ActionsTab
            canRunCommands={commandsEnabled}
            cacheItems={cacheItems}
            cacheSyncing={cacheSyncing}
            onCacheUpload={onCacheUpload}
            onCacheUse={onCacheUse}
            onCacheDelete={onCacheDelete}
            onCacheSync={onCacheSync}
            cachePathPrefix={cachePathPrefix}
            onCommand={onCommand}
          />
        </TabsContent>

        <TabsContent value="memory" className="m-0 p-2 ribbon-tab-content">
          <MemoryTab
            commandsEnabled={commandsEnabled}
            cacheItemsLength={cacheItems.length}
            cacheSyncing={cacheSyncing}
            onCommand={onCommand}
            onJsonUpload={onJsonUpload}
            onCacheUpload={onCacheUpload}
            onCacheSync={onCacheSync}
          />
        </TabsContent>

        <TabsContent value="hex" className="m-0 p-2 ribbon-tab-content">
          <HexTab
            cacheItemsLength={cacheItems.length}
            cacheSyncing={cacheSyncing}
            onCacheUpload={onCacheUpload}
            onCacheSync={onCacheSync}
          />
        </TabsContent>

        <TabsContent value="library" className="m-0 p-2 ribbon-tab-content">
          <LibraryTab onTabChange={onTabChange} />
        </TabsContent>

        <TabsContent value="utilities" className="m-0 p-2 ribbon-tab-content">
          <UtilitiesTab onTabChange={onTabChange} />
        </TabsContent>

        <TabsContent value="attacks" className="m-0 p-2 ribbon-tab-content">
          <AttacksTab commandsEnabled={commandsEnabled} onCommand={onCommand} />
        </TabsContent>

        <TabsContent value="magic" className="m-0 p-2 ribbon-tab-content">
          <MagicTab commandsEnabled={commandsEnabled} onCommand={onCommand} />
        </TabsContent>

        <TabsContent value="traffic" className="m-0 p-2 ribbon-tab-content">
          <TrafficTab commandsEnabled={commandsEnabled} onCommand={onCommand} />
        </TabsContent>

        <TabsContent value="lfops" className="m-0 p-2 ribbon-tab-content">
          <LFOpsTab commandsEnabled={commandsEnabled} onCommand={onCommand} />
        </TabsContent>

        <TabsContent value="t55xx" className="m-0 p-2 ribbon-tab-content">
          <T55xxTab commandsEnabled={commandsEnabled} onCommand={onCommand} />
        </TabsContent>

        <TabsContent value="settings" className="m-0 p-2 ribbon-tab-content">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RibbonToolbar;
