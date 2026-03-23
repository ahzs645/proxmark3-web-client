import type { SettingsState } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const STORAGE_KEY = "pm3-settings";

export function loadSettingsFromStorage(): SettingsState {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(stored) as Partial<SettingsState>) }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettingsToStorage(settings: SettingsState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function exportSettingsToFile(settings: SettingsState): void {
  const data = JSON.stringify(settings, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "pm3-settings.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseSettingsFromText(text: string): SettingsState {
  const imported = JSON.parse(text) as Partial<SettingsState>;
  return { ...DEFAULT_SETTINGS, ...imported };
}
