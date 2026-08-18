import { describe, expect, test } from "vite-plus/test";
import { assessReaderFirmwareHealth } from "./health";
import type { FirmwareEntry, ReaderInspection } from "./types";

const firmware: FirmwareEntry = {
  id: "generic-current",
  display_name: "Current",
  version: "v4.21000",
  description: "fixture",
  platform: "PM3GENERIC",
  recommended: true,
  files: { bootloader: "bootrom.elf", fullimage: "fullimage.elf" },
  checksums: { bootloader_sha256: "a", fullimage_sha256: "b" },
};

function inspection(overrides: Partial<ReaderInspection> = {}): ReaderInspection {
  return {
    mode: "firmware",
    platform: "PM3GENERIC",
    chipFlashKB: 512,
    bootloaderType: "iceman",
    bootrom: { version: "4.21000", buildDate: "2026-01-01", gitHash: "abc1234" },
    firmware: { version: "4.21000", buildDate: "2026-01-01", gitHash: "abc1234" },
    rawVersion: "fixture",
    ...overrides,
  };
}

describe("reader firmware inspection health", () => {
  test("blocks normal operations in bootloader mode", () => {
    expect(assessReaderFirmwareHealth(inspection({ mode: "bootloader" }), [firmware]).level).toBe(
      "recovery",
    );
  });

  test("detects a bootrom/full-image split", () => {
    const health = assessReaderFirmwareHealth(
      inspection({
        bootrom: { version: "4.20000", buildDate: "2025-01-01", gitHash: "def5678" },
      }),
      [firmware],
    );
    expect(health.level).toBe("attention");
    expect(health.details).toContain("Bootrom and full-image release versions differ.");
    expect(health.details).toContain("Bootrom and full-image commits differ.");
  });

  test("recognizes v-prefixed manifest versions", () => {
    expect(assessReaderFirmwareHealth(inspection(), [firmware]).level).toBe("healthy");
  });
});
