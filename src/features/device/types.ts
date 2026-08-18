import type { FirmwareHealth } from "./health";

export type SupportLevel = "supported" | "unsupported" | "unknown";

export type HardwareVariant = "rdv4" | "rdv4-bt" | "generic-256" | "generic" | "unknown";

export interface DeviceFeatureSet {
  lf: SupportLevel;
  hf: SupportLevel;
  smartcard: SupportLevel;
  externalFlash: SupportLevel;
  bluetoothAddon: SupportLevel;
}

/**
 * Facts learned from the connected PM3 rather than assumptions based on a
 * product name. New firmware can add fields without invalidating the profile:
 * every fact carries its raw evidence and unknown remains a valid state.
 */
export interface DeviceProfile {
  model: string | null;
  clientVersion: string | null;
  firmwareVersion: string | null;
  bootromVersion: string | null;
  fpgaVersion: string | null;
  firmwareCompatible: boolean | null;
  firmwareHealth: FirmwareHealth;
  hardwareVariant: HardwareVariant;
  microcontroller: string | null;
  features: DeviceFeatureSet;
  supportedCommands: string[];
  unsupportedCommands: string[];
  evidence: string[];
  observedAt: number | null;
}

export interface DeviceProfileContextValue {
  profile: DeviceProfile;
  resetProfile: () => void;
  refreshProfile: () => void;
}
