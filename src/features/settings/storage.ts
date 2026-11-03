import type { SettingsState } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const STORAGE_KEY = "pm3-settings";

/** Fired on `window` after this tab saves settings; other tabs get `storage`. */
export const SETTINGS_CHANGED_EVENT = "pm3-settings-changed";

export const TERMINAL_FONT_SIZE_MIN = 10;
export const TERMINAL_FONT_SIZE_MAX = 24;

const CARD_TYPES: readonly SettingsState["defaultCardType"][] = ["1k", "4k"];
const OPERATION_PROFILES: readonly SettingsState["operationProfile"][] = [
  "fast",
  "recommended",
  "thorough",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function clampTerminalFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.terminalFontSize;
  return Math.min(TERMINAL_FONT_SIZE_MAX, Math.max(TERMINAL_FONT_SIZE_MIN, Math.round(value)));
}

/**
 * Builds a valid settings object from untrusted input, field by field. Fields
 * that are missing or of the wrong type keep their value from `base`.
 */
export function sanitizeSettings(
  input: object,
  base: SettingsState = DEFAULT_SETTINGS,
): SettingsState {
  const raw = input as Record<string, unknown>;
  const next: SettingsState = { ...base };
  const str = (key: keyof SettingsState) =>
    typeof raw[key] === "string" ? (raw[key] as string) : undefined;
  const bool = (key: keyof SettingsState) =>
    typeof raw[key] === "boolean" ? (raw[key] as boolean) : undefined;

  const cardType = str("defaultCardType");
  if (cardType && (CARD_TYPES as readonly string[]).includes(cardType)) {
    next.defaultCardType = cardType as SettingsState["defaultCardType"];
  }
  const authKey = str("defaultAuthKey")?.trim().toUpperCase();
  if (authKey && /^[0-9A-F]{12}$/.test(authKey)) next.defaultAuthKey = authKey;
  const profile = str("operationProfile");
  if (profile && (OPERATION_PROFILES as readonly string[]).includes(profile)) {
    next.operationProfile = profile as SettingsState["operationProfile"];
  }
  if (typeof raw.terminalFontSize === "number") {
    next.terminalFontSize = clampTerminalFontSize(raw.terminalFontSize);
  }

  next.confirmDestructiveOps = bool("confirmDestructiveOps") ?? next.confirmDestructiveOps;
  next.showAdvancedOptions = bool("showAdvancedOptions") ?? next.showAdvancedOptions;
  next.nativePm3BinaryPath = str("nativePm3BinaryPath") ?? next.nativePm3BinaryPath;
  next.nativePm3Port = str("nativePm3Port") ?? next.nativePm3Port;
  next.bleCustomServiceUuid = str("bleCustomServiceUuid") ?? next.bleCustomServiceUuid;
  next.bleCustomWriteUuid = str("bleCustomWriteUuid") ?? next.bleCustomWriteUuid;
  next.bleCustomNotifyUuid = str("bleCustomNotifyUuid") ?? next.bleCustomNotifyUuid;
  return next;
}

export function loadSettingsFromStorage(): SettingsState {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(stored);
    return isRecord(parsed) ? sanitizeSettings(parsed) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Validated settings as the rest of the app sees them. Kept in memory so a
// failed localStorage write still reaches readers in this tab.
let snapshot: SettingsState | null = null;

export function getSettingsSnapshot(): SettingsState {
  snapshot ??= loadSettingsFromStorage();
  return snapshot;
}

export function subscribeToSettings(onChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    // `key` is null when another tab cleared all of localStorage.
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    snapshot = loadSettingsFromStorage();
    onChange();
  };
  window.addEventListener(SETTINGS_CHANGED_EVENT, onChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(SETTINGS_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", handleStorage);
  };
}

/** Returns false when the browser refused the write (quota, private mode). */
export function saveSettingsToStorage(settings: SettingsState): boolean {
  if (typeof window === "undefined") return false;
  snapshot = sanitizeSettings(settings);
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function exportSettingsToFile(settings: SettingsState): void {
  const data = JSON.stringify(settings, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "pm3-settings.json";
  // Firefox ignores clicks on detached anchors, and revoking the URL in the
  // same tick can cancel the download before it starts.
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Throws an Error with a user-facing message when the text is not settings. */
export function parseSettingsFromText(
  text: string,
  base: SettingsState = DEFAULT_SETTINGS,
): SettingsState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  if (!isRecord(parsed)) {
    throw new Error("The file does not contain a settings object.");
  }
  return sanitizeSettings(parsed, base);
}
