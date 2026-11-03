import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DEFAULT_SETTINGS } from "./types";
import {
  SETTINGS_CHANGED_EVENT,
  clampTerminalFontSize,
  getSettingsSnapshot,
  loadSettingsFromStorage,
  parseSettingsFromText,
  sanitizeSettings,
  saveSettingsToStorage,
  subscribeToSettings,
} from "./storage";

function stubBrowser(storage: Partial<Storage>) {
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("localStorage", storage);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("clampTerminalFontSize", () => {
  it("keeps the size within 10-24", () => {
    expect(clampTerminalFontSize(4)).toBe(10);
    expect(clampTerminalFontSize(99)).toBe(24);
    expect(clampTerminalFontSize(15.6)).toBe(16);
    expect(clampTerminalFontSize(Number.NaN)).toBe(DEFAULT_SETTINGS.terminalFontSize);
  });
});

describe("sanitizeSettings", () => {
  it("accepts valid fields and normalises the auth key", () => {
    const result = sanitizeSettings({
      defaultCardType: "4k",
      defaultAuthKey: " a0a1a2a3a4a5 ",
      confirmDestructiveOps: false,
      terminalFontSize: 30,
      showAdvancedOptions: true,
      operationProfile: "thorough",
      nativePm3Port: "/dev/ttyACM0",
    });
    expect(result).toEqual({
      ...DEFAULT_SETTINGS,
      defaultCardType: "4k",
      defaultAuthKey: "A0A1A2A3A4A5",
      confirmDestructiveOps: false,
      terminalFontSize: 24,
      showAdvancedOptions: true,
      operationProfile: "thorough",
      nativePm3Port: "/dev/ttyACM0",
    });
  });

  it("ignores wrong types and unknown values, keeping the base", () => {
    const base = { ...DEFAULT_SETTINGS, defaultCardType: "4k" as const, terminalFontSize: 18 };
    const result = sanitizeSettings(
      {
        defaultCardType: "2k",
        defaultAuthKey: "FFFF",
        confirmDestructiveOps: "no",
        terminalFontSize: "20",
        operationProfile: 3,
        nativePm3BinaryPath: null,
        extra: "ignored",
      },
      base,
    );
    expect(result).toEqual(base);
  });
});

describe("parseSettingsFromText", () => {
  it("rejects invalid JSON and non-object JSON with a clear message", () => {
    expect(() => parseSettingsFromText("{nope")).toThrow("not valid JSON");
    expect(() => parseSettingsFromText("[1, 2]")).toThrow("does not contain a settings object");
    expect(() => parseSettingsFromText("null")).toThrow("does not contain a settings object");
    expect(() => parseSettingsFromText('"text"')).toThrow("does not contain a settings object");
  });

  it("merges a partial file onto the base settings", () => {
    const base = { ...DEFAULT_SETTINGS, showAdvancedOptions: true };
    expect(parseSettingsFromText('{"terminalFontSize": 12}', base)).toEqual({
      ...base,
      terminalFontSize: 12,
    });
  });
});

describe("storage access", () => {
  it("falls back to defaults when localStorage throws or holds garbage", () => {
    stubBrowser({
      getItem: () => {
        throw new Error("SecurityError");
      },
    });
    expect(loadSettingsFromStorage()).toEqual(DEFAULT_SETTINGS);

    stubBrowser({ getItem: () => "[]" });
    expect(loadSettingsFromStorage()).toEqual(DEFAULT_SETTINGS);
  });

  it("survives a failed write and still notifies readers in this tab", () => {
    stubBrowser({
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    const onChange = vi.fn();
    const unsubscribe = subscribeToSettings(onChange);

    const next = { ...DEFAULT_SETTINGS, terminalFontSize: 40, confirmDestructiveOps: false };
    expect(saveSettingsToStorage(next)).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(getSettingsSnapshot()).toMatchObject({
      terminalFontSize: 24,
      confirmDestructiveOps: false,
    });

    unsubscribe();
    window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
