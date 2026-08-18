export interface SettingsState {
  defaultCardType: "1k" | "4k";
  defaultAuthKey: string;
  confirmDestructiveOps: boolean;
  terminalFontSize: number;
  showAdvancedOptions: boolean;
  operationProfile: "fast" | "recommended" | "thorough";
  nativePm3BinaryPath: string;
  nativePm3Port: string;
}

export const DEFAULT_SETTINGS: SettingsState = {
  defaultCardType: "1k",
  defaultAuthKey: "FFFFFFFFFFFF",
  confirmDestructiveOps: true,
  terminalFontSize: 14,
  showAdvancedOptions: false,
  operationProfile: "recommended",
  nativePm3BinaryPath: "",
  nativePm3Port: "",
};
