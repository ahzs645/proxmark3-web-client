import { parseFirmwareElf } from "./elf";
import type { ElfSegment, FirmwareEntry, FirmwareManifest } from "./types";

export const FIRMWARE_SOURCE = "https://proxmark3.app";

function isFirmwareManifest(value: unknown): value is FirmwareManifest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FirmwareManifest>;
  return (
    candidate.manifest_version === 1 &&
    Array.isArray(candidate.firmwares) &&
    candidate.firmwares.every(
      (entry) =>
        entry &&
        typeof entry.id === "string" &&
        typeof entry.version === "string" &&
        (entry.platform === "PM3GENERIC" || entry.platform === "PM3RDV4") &&
        typeof entry.files?.bootloader === "string" &&
        typeof entry.files?.fullimage === "string" &&
        typeof entry.checksums?.bootloader_sha256 === "string" &&
        typeof entry.checksums?.fullimage_sha256 === "string",
    )
  );
}

export async function fetchFirmwareManifest(): Promise<FirmwareManifest> {
  const response = await fetch(`${FIRMWARE_SOURCE}/api/firmware/manifest`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Firmware manifest request failed (HTTP ${response.status})`);
  const manifest: unknown = await response.json();
  if (!isFirmwareManifest(manifest))
    throw new Error("Firmware server returned an invalid manifest");
  return manifest;
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function downloadAndVerify(url: string, expectedSha256: string): Promise<ArrayBuffer> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Firmware download failed (HTTP ${response.status})`);
  const buffer = await response.arrayBuffer();
  const actualSha256 = await sha256Hex(buffer);
  if (actualSha256 !== expectedSha256.toLowerCase()) {
    throw new Error(`Firmware checksum mismatch for ${url.split("/").pop()}`);
  }
  return buffer;
}

export async function downloadFirmware(entry: FirmwareEntry): Promise<{
  bootromSegments: ElfSegment[];
  fullimageSegments: ElfSegment[];
}> {
  // The API routes are stable and prevent a manifest from redirecting the app
  // to an unrelated host while still letting the server organize file storage.
  const root = `${FIRMWARE_SOURCE}/api/firmware/${encodeURIComponent(entry.id)}`;
  const [bootrom, fullimage] = await Promise.all([
    downloadAndVerify(`${root}/bootrom.elf`, entry.checksums.bootloader_sha256),
    downloadAndVerify(`${root}/fullimage.elf`, entry.checksums.fullimage_sha256),
  ]);
  const bootromSegments = parseFirmwareElf(bootrom);
  const fullimageSegments = parseFirmwareElf(fullimage);
  if (bootromSegments.length === 0 || fullimageSegments.length === 0) {
    throw new Error("Downloaded firmware contains no flashable SAM7 segments");
  }
  return { bootromSegments, fullimageSegments };
}
