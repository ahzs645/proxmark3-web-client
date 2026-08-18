import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PanelHeader } from "@/components/panels/shared/PanelHeader";
import { Settings, Check } from "lucide-react";
import type { Theme } from "@/hooks/useTheme";
import { AppearanceSection } from "@/features/settings/components/AppearanceSection";
import { BehaviorSection } from "@/features/settings/components/BehaviorSection";
import { DataManagementSection } from "@/features/settings/components/DataManagementSection";
import { DefaultsSection } from "@/features/settings/components/DefaultsSection";
import { useSettingsState } from "@/features/settings/useSettingsState";
import { FirmwareUpdateSection } from "@/features/firmware/FirmwareUpdateSection";
import type { TransportType } from "@/lib/transports";
import { NativeRuntimeSection } from "@/features/runtime/NativeRuntimeSection";

interface SettingsPanelProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onClearCache?: () => void;
  cacheCount?: number;
  isDeviceConnected: boolean;
  activeTransportType: TransportType | null;
  onDisconnectApplication: () => Promise<void>;
  onReconnectApplication: () => Promise<boolean>;
  onFirmwareLog?: (message: string) => void;
}

export function SettingsPanel({
  theme,
  onThemeChange,
  onClearCache,
  cacheCount = 0,
  isDeviceConnected,
  activeTransportType,
  onDisconnectApplication,
  onReconnectApplication,
  onFirmwareLog,
}: SettingsPanelProps) {
  const {
    settings,
    saved,
    importError,
    clearImportError,
    setDefaultCardType,
    setDefaultAuthKey,
    setConfirmDestructiveOps,
    setTerminalFontSize,
    setShowAdvancedOptions,
    setOperationProfile,
    setNativePm3BinaryPath,
    setNativePm3Port,
    exportSettings,
    importSettings,
    resetSettings,
  } = useSettingsState();

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <PanelHeader
        icon={Settings}
        title="Settings"
        tag="Preferences"
        actions={
          saved ? (
            <Badge variant="success" className="gap-1">
              <Check className="h-3 w-3" />
              Saved
            </Badge>
          ) : null
        }
      />

      <CardContent className="flex-1 space-y-6 overflow-auto p-4">
        <AppearanceSection
          theme={theme}
          onThemeChange={onThemeChange}
          terminalFontSize={settings.terminalFontSize}
          onTerminalFontSizeChange={setTerminalFontSize}
        />

        <DefaultsSection
          defaultCardType={settings.defaultCardType}
          defaultAuthKey={settings.defaultAuthKey}
          onDefaultCardTypeChange={setDefaultCardType}
          onDefaultAuthKeyChange={setDefaultAuthKey}
        />

        <BehaviorSection
          confirmDestructiveOps={settings.confirmDestructiveOps}
          showAdvancedOptions={settings.showAdvancedOptions}
          onConfirmDestructiveOpsChange={setConfirmDestructiveOps}
          onShowAdvancedOptionsChange={setShowAdvancedOptions}
          operationProfile={settings.operationProfile}
          onOperationProfileChange={setOperationProfile}
        />

        <FirmwareUpdateSection
          isDeviceConnected={isDeviceConnected}
          activeTransportType={activeTransportType}
          onDisconnectApplication={onDisconnectApplication}
          onReconnectApplication={onReconnectApplication}
          onLog={onFirmwareLog}
        />

        <NativeRuntimeSection
          binaryPath={settings.nativePm3BinaryPath}
          port={settings.nativePm3Port}
          onBinaryPathChange={setNativePm3BinaryPath}
          onPortChange={setNativePm3Port}
          onLog={onFirmwareLog}
        />

        <DataManagementSection
          cacheCount={cacheCount}
          importError={importError}
          onClearImportError={clearImportError}
          onExportSettings={exportSettings}
          onImportSettings={importSettings}
          onResetSettings={resetSettings}
          onClearCache={onClearCache}
        />
      </CardContent>
    </Card>
  );
}

export default SettingsPanel;
