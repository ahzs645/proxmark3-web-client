import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS } from "./types";
import type { SettingsState } from "./types";
import { getSettingsSnapshot, subscribeToSettings } from "./storage";

/**
 * Read-only view of the saved settings for panels outside Settings. Re-renders
 * when Settings saves a change in this tab or another one.
 */
export function useAppSettings(): SettingsState {
  return useSyncExternalStore(subscribeToSettings, getSettingsSnapshot, () => DEFAULT_SETTINGS);
}
