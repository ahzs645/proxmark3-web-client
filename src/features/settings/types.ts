export interface SettingsState {
  defaultCardType: "1k" | "4k";
  defaultAuthKey: string;
  confirmDestructiveOps: boolean;
  terminalFontSize: number;
  showAdvancedOptions: boolean;
  operationProfile: "fast" | "recommended" | "thorough";
  nativePm3BinaryPath: string;
  nativePm3Port: string;
  /** Custom BLE UART bridge; all blank means only the built-in profiles. */
  bleCustomServiceUuid: string;
  bleCustomWriteUuid: string;
  bleCustomNotifyUuid: string;
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
  bleCustomServiceUuid: "",
  bleCustomWriteUuid: "",
  bleCustomNotifyUuid: "",
};
