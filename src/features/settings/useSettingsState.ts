import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { DEFAULT_SETTINGS } from "./types";
import type { SettingsState } from "./types";
import {
  exportSettingsToFile,
  getSettingsSnapshot,
  parseSettingsFromText,
  saveSettingsToStorage,
} from "./storage";

export function useSettingsState() {
  const [settings, setSettings] = useState<SettingsState>(getSettingsSnapshot);
  const [saved, setSaved] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

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
  const setOperationProfile = useCallback(
    (value: SettingsState["operationProfile"]) => updateSetting("operationProfile", value),
    [updateSetting],
  );
  const setNativePm3BinaryPath = useCallback(
    (value: string) => updateSetting("nativePm3BinaryPath", value),
    [updateSetting],
  );
  const setNativePm3Port = useCallback(
    (value: string) => updateSetting("nativePm3Port", value),
    [updateSetting],
  );
  const setBleCustomUuids = useCallback(
    (value: { service: string; write: string; notify: string }) => {
      setSettings((prev) => ({
        ...prev,
        bleCustomServiceUuid: value.service,
        bleCustomWriteUuid: value.write,
        bleCustomNotifyUuid: value.notify,
      }));
      setSaved(true);
    },
    [],
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
            throw new Error("The file could not be read as text.");
          }
          persistSettings(parseSettingsFromText(reader.result, settings));
          setImportError(null);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          setImportError(`Failed to import settings. ${reason}`);
        }
      };
      reader.onerror = () => {
        setImportError("Failed to import settings. The file could not be read.");
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [persistSettings, settings],
  );

  const clearImportError = useCallback(() => setImportError(null), []);

  const resetSettings = useCallback(() => {
    persistSettings(DEFAULT_SETTINGS);
  }, [persistSettings]);

  return {
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
    setBleCustomUuids,
    exportSettings,
    importSettings,
    resetSettings,
  };
}
