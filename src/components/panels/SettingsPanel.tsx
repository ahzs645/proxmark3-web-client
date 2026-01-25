import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  Palette,
  Key,
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  Check,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Theme } from "@/hooks/useTheme";

interface SettingsPanelProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onClearCache?: () => void;
  cacheCount?: number;
}

interface SettingsState {
  defaultCardType: "1k" | "4k";
  defaultAuthKey: string;
  confirmDestructiveOps: boolean;
  terminalFontSize: number;
  showAdvancedOptions: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  defaultCardType: "1k",
  defaultAuthKey: "FFFFFFFFFFFF",
  confirmDestructiveOps: true,
  terminalFontSize: 14,
  showAdvancedOptions: false,
};

const STORAGE_KEY = "pm3-settings";

function loadSettings(): SettingsState {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: SettingsState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function SettingsPanel({
  theme,
  onThemeChange,
  onClearCache,
  cacheCount = 0,
}: SettingsPanelProps) {
  const [settings, setSettings] = useState<SettingsState>(loadSettings);
  const [saved, setSaved] = useState(false);

  const handleSettingChange = useCallback(
    <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
      setSettings((prev) => {
        const newSettings = { ...prev, [key]: value };
        saveSettings(newSettings);
        return newSettings;
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    []
  );

  const handleExportSettings = useCallback(() => {
    const data = JSON.stringify(settings, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pm3-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [settings]);

  const handleImportSettings = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result as string);
        const newSettings = { ...DEFAULT_SETTINGS, ...imported };
        setSettings(newSettings);
        saveSettings(newSettings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch {
        alert("Failed to import settings. Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleResetSettings = useCallback(() => {
    if (confirm("Reset all settings to defaults?")) {
      setSettings(DEFAULT_SETTINGS);
      saveSettings(DEFAULT_SETTINGS);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }, []);

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            Settings
            <Badge variant="outline" className="ml-1">
              Preferences
            </Badge>
          </CardTitle>
          {saved && (
            <Badge variant="success" className="gap-1">
              <Check className="h-3 w-3" />
              Saved
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-4 space-y-6">
        {/* Appearance */}
        <div className="space-y-3">
          <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Palette className="h-3 w-3" />
            Appearance
          </label>

          <div className="space-y-2">
            <label className="text-sm font-medium">Theme</label>
            <div className="flex rounded-md overflow-hidden border w-fit">
              <Button
                size="sm"
                variant={theme === "light" ? "default" : "ghost"}
                onClick={() => onThemeChange("light")}
                className="h-8 rounded-none gap-1"
              >
                <Sun className="h-3 w-3" />
                Light
              </Button>
              <Button
                size="sm"
                variant={theme === "dark" ? "default" : "ghost"}
                onClick={() => onThemeChange("dark")}
                className="h-8 rounded-none gap-1"
              >
                <Moon className="h-3 w-3" />
                Dark
              </Button>
              <Button
                size="sm"
                variant={theme === "system" ? "default" : "ghost"}
                onClick={() => onThemeChange("system")}
                className="h-8 rounded-none gap-1"
              >
                <Monitor className="h-3 w-3" />
                System
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Terminal Font Size</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={10}
                max={24}
                value={settings.terminalFontSize}
                onChange={(e) =>
                  handleSettingChange("terminalFontSize", parseInt(e.target.value) || 14)
                }
                className="w-20 h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">px</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Defaults */}
        <div className="space-y-3">
          <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Key className="h-3 w-3" />
            Default Values
          </label>

          <div className="space-y-2">
            <label className="text-sm font-medium">Default Card Type</label>
            <div className="flex rounded-md overflow-hidden border w-fit">
              <Button
                size="sm"
                variant={settings.defaultCardType === "1k" ? "default" : "ghost"}
                onClick={() => handleSettingChange("defaultCardType", "1k")}
                className="h-8 rounded-none"
              >
                1K
              </Button>
              <Button
                size="sm"
                variant={settings.defaultCardType === "4k" ? "default" : "ghost"}
                onClick={() => handleSettingChange("defaultCardType", "4k")}
                className="h-8 rounded-none"
              >
                4K
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Default Authentication Key</label>
            <Input
              value={settings.defaultAuthKey}
              onChange={(e) =>
                handleSettingChange(
                  "defaultAuthKey",
                  e.target.value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 12)
                )
              }
              placeholder="FFFFFFFFFFFF"
              className={cn(
                "font-mono text-xs w-40",
                settings.defaultAuthKey.length === 12 && "border-green-500/50"
              )}
              maxLength={12}
            />
          </div>
        </div>

        <Separator />

        {/* Behavior */}
        <div className="space-y-3">
          <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Settings className="h-3 w-3" />
            Behavior
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={settings.confirmDestructiveOps}
              onChange={(e) => handleSettingChange("confirmDestructiveOps", e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Confirm destructive operations (wipe, format)</span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showAdvancedOptions}
              onChange={(e) => handleSettingChange("showAdvancedOptions", e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Show advanced options by default</span>
          </label>
        </div>

        <Separator />

        {/* Data Management */}
        <div className="space-y-3">
          <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Trash2 className="h-3 w-3" />
            Data Management
          </label>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportSettings}
              className="gap-1"
            >
              <Download className="h-3 w-3" />
              Export Settings
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 relative overflow-hidden"
            >
              <Upload className="h-3 w-3" />
              Import Settings
              <input
                type="file"
                accept=".json"
                onChange={handleImportSettings}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleResetSettings}
              className="gap-1"
            >
              Reset to Defaults
            </Button>
          </div>

          {onClearCache && (
            <div className="pt-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm(`Clear all ${cacheCount} cached files?`)) {
                    onClearCache();
                  }
                }}
                disabled={cacheCount === 0}
                className="gap-1"
              >
                <Trash2 className="h-3 w-3" />
                Clear Cache ({cacheCount} files)
              </Button>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3 bg-secondary/30 rounded text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Storage:</strong> Settings are saved in browser localStorage
          </p>
          <p>
            <strong>Note:</strong> Some settings may require a page refresh to take effect
          </p>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded text-[10px] text-amber-400">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            Clearing the cache will remove all uploaded key files and dumps from browser storage.
            Make sure to backup important files first.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default SettingsPanel;
