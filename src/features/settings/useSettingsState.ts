import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { DEFAULT_SETTINGS } from "./types";
import type { SettingsState } from "./types";
import {
  exportSettingsToFile,
  loadSettingsFromStorage,
  parseSettingsFromText,
  saveSettingsToStorage,
} from "./storage";

export function useSettingsState() {
  const [settings, setSettings] = useState<SettingsState>(loadSettingsFromStorage);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    saveSettingsToStorage(settings);
  }, [settings]);

  useEffect(() => {
    if (!saved) return;
    const timeout = window.setTimeout(() => setSaved(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [saved]);

  const persistSettings = useCallback((next: SettingsState) => {
    setSettings(next);
    setSaved(true);
  }, []);

  const updateSetting = useCallback(
    <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
      setSaved(true);
    },
    [],
  );

  const setDefaultCardType = useCallback(
    (value: SettingsState["defaultCardType"]) => updateSetting("defaultCardType", value),
    [updateSetting],
  );
  const setDefaultAuthKey = useCallback(
    (value: string) => updateSetting("defaultAuthKey", value),
    [updateSetting],
  );
  const setConfirmDestructiveOps = useCallback(
    (value: boolean) => updateSetting("confirmDestructiveOps", value),
    [updateSetting],
  );
  const setTerminalFontSize = useCallback(
    (value: number) => updateSetting("terminalFontSize", value),
    [updateSetting],
  );
  const setShowAdvancedOptions = useCallback(
    (value: boolean) => updateSetting("showAdvancedOptions", value),
    [updateSetting],
  );

  const exportSettings = useCallback(() => {
    exportSettingsToFile(settings);
  }, [settings]);

  const importSettings = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          if (typeof reader.result !== "string") {
            throw new Error("Unexpected file reader result");
          }
          const parsed = parseSettingsFromText(reader.result);
          persistSettings(parsed);
        } catch {
          alert("Failed to import settings. Invalid JSON file.");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [persistSettings],
  );

  const resetSettings = useCallback(() => {
    if (!confirm("Reset all settings to defaults?")) return;
    persistSettings(DEFAULT_SETTINGS);
  }, [persistSettings]);

  return {
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
  };
}
