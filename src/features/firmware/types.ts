/**
 * PM3GENERIC / PM3RDV4 are the AT91SAM7 boards this flasher can write.
 * PM5 (Proxmark5, AT32F437) is recognised so the UI can identify it, but its
 * flash layout differs and no verified image source exists yet, so it is
 * never flashed from here.
 */
export type FirmwarePlatform = "PM3GENERIC" | "PM3RDV4" | "PM5";

export const FLASHABLE_PLATFORMS: readonly FirmwarePlatform[] = ["PM3GENERIC", "PM3RDV4"];

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
