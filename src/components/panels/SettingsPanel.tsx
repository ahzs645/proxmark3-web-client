import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Check } from "lucide-react";
import type { Theme } from "@/hooks/useTheme";
import { AppearanceSection } from "@/features/settings/components/AppearanceSection";
import { BehaviorSection } from "@/features/settings/components/BehaviorSection";
import { DataManagementSection } from "@/features/settings/components/DataManagementSection";
import { DefaultsSection } from "@/features/settings/components/DefaultsSection";
import { useSettingsState } from "@/features/settings/useSettingsState";

interface SettingsPanelProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onClearCache?: () => void;
  cacheCount?: number;
}

export function SettingsPanel({
  theme,
  onThemeChange,
  onClearCache,
  cacheCount = 0,
}: SettingsPanelProps) {
  const {
    settings,
    saved,
    setDefaultCardType,
    setDefaultAuthKey,
    setConfirmDestructiveOps,
    setTerminalFontSize,
    setShowAdvancedOptions,
    exportSettings,
    importSettings,
    resetSettings,
  } = useSettingsState();

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="border-b pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Settings className="h-4 w-4 text-primary" />
            Settings
            <Badge variant="outline" className="ml-1">
              Preferences
            </Badge>
          </CardTitle>
          {saved ? (
            <Badge variant="success" className="gap-1">
              <Check className="h-3 w-3" />
              Saved
            </Badge>
          ) : null}
        </div>
      </CardHeader>

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
        />

        <DataManagementSection
          cacheCount={cacheCount}
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
