import type { FirmwareEntry, ReaderInspection } from "./types";

export type ReaderHealthLevel = "healthy" | "attention" | "recovery" | "unknown";

export interface ReaderFirmwareHealth {
  level: ReaderHealthLevel;
  title: string;
  details: string[];
  recommendedFirmwareId: string | null;
}

function normalizeVersion(value: string): string {
  return value.trim().replace(/^v/i, "").toLowerCase();
}

export function firmwareVersionsMatch(left: string, right: string): boolean {
  return Boolean(left && right && normalizeVersion(left) === normalizeVersion(right));
}

export function assessReaderFirmwareHealth(
  inspection: ReaderInspection | null,
  compatibleFirmware: FirmwareEntry[],
): ReaderFirmwareHealth {
  if (!inspection) {
    return {
      level: "unknown",
      title: "Inspect the reader to establish firmware health",
      details: [],
      recommendedFirmwareId: null,
    };
  }

  const recommended = compatibleFirmware.find((entry) => entry.recommended) ?? null;
  if (inspection.mode === "bootloader") {
    return {
      level: "recovery",
      title: "Reader is in bootloader recovery mode",
      details: [
        "Card operations are unavailable until a compatible full image is flashed and verified.",
      ],
      recommendedFirmwareId: recommended?.id ?? null,
    };
  }
  if (inspection.platform === "unknown") {
    return {
      level: "recovery",
      title: "Hardware platform is not verified",
      details: ["Flashing remains blocked to prevent writing an image for the wrong board."],
      recommendedFirmwareId: null,
    };
  }

  const details: string[] = [];
  if (!inspection.firmware?.version) {
    details.push("The running firmware version could not be read.");
  }
  if (
    inspection.bootrom?.version &&
    inspection.firmware?.version &&
    !firmwareVersionsMatch(inspection.bootrom.version, inspection.firmware.version)
  ) {
    details.push("Bootrom and full-image release versions differ.");
  }
  if (
    inspection.bootrom?.gitHash &&
    inspection.firmware?.gitHash &&
    inspection.bootrom.gitHash.toLowerCase() !== inspection.firmware.gitHash.toLowerCase()
  ) {
    details.push("Bootrom and full-image commits differ.");
  }
  if (
    recommended &&
    inspection.firmware?.version &&
    !firmwareVersionsMatch(inspection.firmware.version, recommended.version)
  ) {
    details.push(`Recommended compatible release ${recommended.version} is not installed.`);
  }

  return details.length > 0
    ? {
        level: "attention",
        title: "Firmware attention recommended",
        details,
        recommendedFirmwareId: recommended?.id ?? null,
      }
    : {
        level: "healthy",
        title: "Firmware identity and platform are consistent",
        details: ["No component mismatch was found in the reader inspection."],
        recommendedFirmwareId: recommended?.id ?? null,
      };
}
