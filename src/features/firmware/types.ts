/**
 * PM3GENERIC / PM3RDV4 are AT91SAM7 boards; PM5 (Proxmark5) is an AT32F435/437.
 * The flash layout for each comes from the bootloader (see `flashTargetFor`).
 */
export type FirmwarePlatform = "PM3GENERIC" | "PM3RDV4" | "PM5";

export const FLASHABLE_PLATFORMS: readonly FirmwarePlatform[] = ["PM3GENERIC", "PM3RDV4", "PM5"];

export function isFlashablePlatform(platform: FirmwarePlatform | "unknown"): boolean {
  return FLASHABLE_PLATFORMS.includes(platform as FirmwarePlatform);
}

export interface FirmwareFileSet {
  bootloader: string;
  fullimage: string;
}

export interface FirmwareChecksums {
  bootloader_sha256: string;
  fullimage_sha256: string;
}

export interface FirmwareEntry {
  id: string;
  display_name: string;
  version: string;
  description: string;
  platform: FirmwarePlatform;
  recommended?: boolean;
  build_date?: string;
  files: FirmwareFileSet;
  checksums: FirmwareChecksums;
  /** Where the files come from: shipped with this app, or the remote server. Set by the client. */
  source?: "bundled" | "remote";
}

export interface FirmwareManifest {
  manifest_version: number;
  firmwares: FirmwareEntry[];
}

export interface FirmwareVersionPart {
  version: string;
  buildDate: string;
  gitHash: string;
}

export interface ReaderInspection {
  mode: "firmware" | "bootloader";
  platform: FirmwarePlatform | "unknown";
  /** Detected silicon family: at91 = Proxmark3, at32 = Proxmark5. */
  chipFamily: import("./flashDevice").ChipFamily | null;
  chipFlashKB: number;
  bootloaderType: "legacy" | "iceman" | "unknown";
  bootrom: FirmwareVersionPart | null;
  firmware: FirmwareVersionPart | null;
  rawVersion: string;
}

export type FirmwarePhase =
  | "idle"
  | "inspecting"
  | "downloading"
  | "entering_bootloader"
  | "reconnecting"
  | "flashing_bootrom"
  | "rebooting_bootloader"
  | "flashing_fullimage"
  | "rebooting"
  | "verifying"
  | "complete"
  | "error";

export interface FirmwareProgress {
  phase: FirmwarePhase;
  percent: number;
  message: string;
}

export interface ElfSegment {
  address: number;
  data: Uint8Array;
}
