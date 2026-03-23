export interface SettingsState {
  defaultCardType: "1k" | "4k";
  defaultAuthKey: string;
  confirmDestructiveOps: boolean;
  terminalFontSize: number;
  showAdvancedOptions: boolean;
}

export const DEFAULT_SETTINGS: SettingsState = {
  defaultCardType: "1k",
  defaultAuthKey: "FFFFFFFFFFFF",
  confirmDestructiveOps: true,
  terminalFontSize: 14,
  showAdvancedOptions: false,
};
