export type FirmwarePlatform = "PM3GENERIC" | "PM3RDV4";

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
