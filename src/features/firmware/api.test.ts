import { describe, expect, test } from "vite-plus/test";
import { mergeFirmwareManifests } from "./api";
import type { FirmwareEntry, FirmwareManifest } from "./types";

function entry(id: string, platform: FirmwareEntry["platform"], recommended = true): FirmwareEntry {
  return {
    id,
    display_name: id,
    version: "4.23346",
    description: "",
    platform,
    recommended,
    files: { bootloader: `${id}/bootrom.elf`, fullimage: `${id}/fullimage.elf` },
    checksums: { bootloader_sha256: "a", fullimage_sha256: "b" },
  };
}

function manifest(...firmwares: FirmwareEntry[]): FirmwareManifest {
  return { manifest_version: 1, firmwares };
}

describe("mergeFirmwareManifests", () => {
  test("lists bundled builds first and tags each entry with its source", () => {
    const merged = mergeFirmwareManifests(
      manifest(entry("bundled-pm5", "PM5")),
      manifest(entry("rrg-4.21128", "PM3GENERIC")),
    );
    expect(merged.firmwares.map((item) => [item.id, item.source])).toEqual([
      ["bundled-pm5", "bundled"],
      ["rrg-4.21128", "remote"],
    ]);
  });

  test("a bundled build takes over the recommendation for its platform only", () => {
    const merged = mergeFirmwareManifests(
      manifest(entry("bundled-easy", "PM3GENERIC")),
      manifest(entry("remote-easy", "PM3GENERIC"), entry("remote-rdv4", "PM3RDV4")),
    );
    const recommended = Object.fromEntries(
      merged.firmwares.map((item) => [item.id, item.recommended]),
    );
    expect(recommended).toEqual({
      "bundled-easy": true,
      "remote-easy": false,
      "remote-rdv4": true,
    });
  });

  test("works with either source missing", () => {
    expect(mergeFirmwareManifests(null, manifest(entry("r", "PM5"))).firmwares).toHaveLength(1);
    expect(mergeFirmwareManifests(manifest(entry("b", "PM5")), null).firmwares).toHaveLength(1);
    expect(mergeFirmwareManifests(null, null).firmwares).toEqual([]);
  });
});
