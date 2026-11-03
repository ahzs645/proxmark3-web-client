import { parseElfImage, type ElfImage } from "./elf";
import type { FirmwareEntry, FirmwareManifest } from "./types";

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
        (entry.platform === "PM3GENERIC" ||
          entry.platform === "PM3RDV4" ||
          entry.platform === "PM5") &&
        typeof entry.files?.bootloader === "string" &&
        typeof entry.files?.fullimage === "string" &&
        typeof entry.checksums?.bootloader_sha256 === "string" &&
        typeof entry.checksums?.fullimage_sha256 === "string",
    )
  );
}

/** Firmware shipped with the app (scripts/bundle-firmware.cjs), relative to the page. */
export const BUNDLED_FIRMWARE_PATH = "firmware";

async function fetchManifest(url: string, label: string): Promise<FirmwareManifest> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${label} manifest request failed (HTTP ${response.status})`);
  const manifest: unknown = await response.json();
  if (!isFirmwareManifest(manifest)) throw new Error(`${label} returned an invalid manifest`);
  return manifest;
}

/**
 * Bundled firmware comes first and is the recommendation for its platform:
 * it is built from the same commit as this app's client, so its capabilities
 * version always matches. Remote packages stay selectable, but no longer claim
 * "recommended" for a platform that has a bundled build. Either source may be
 * missing; only both failing is an error.
 */
export function mergeFirmwareManifests(
  bundled: FirmwareManifest | null,
  remote: FirmwareManifest | null,
): FirmwareManifest {
  const local = (bundled?.firmwares ?? []).map((entry) => ({
    ...entry,
    source: "bundled" as const,
  }));
  const covered = new Set(local.map((entry) => entry.platform));
  const fromServer = (remote?.firmwares ?? []).map((entry) => ({
    ...entry,
    source: "remote" as const,
    recommended: covered.has(entry.platform) ? false : entry.recommended,
  }));
  return { manifest_version: 1, firmwares: [...local, ...fromServer] };
}

export async function fetchFirmwareManifest(): Promise<FirmwareManifest> {
  const [bundled, remote] = await Promise.allSettled([
    fetchManifest(`${BUNDLED_FIRMWARE_PATH}/manifest.json`, "Bundled firmware"),
    fetchManifest(`${FIRMWARE_SOURCE}/api/firmware/manifest`, "Firmware server"),
  ]);
  if (bundled.status === "rejected" && remote.status === "rejected") {
    throw remote.reason instanceof Error ? remote.reason : new Error(String(remote.reason));
  }
  return mergeFirmwareManifests(
    bundled.status === "fulfilled" ? bundled.value : null,
    remote.status === "fulfilled" ? remote.value : null,
  );
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

/** A bootrom + fullimage pair ready to flash. */
export interface FirmwareImages {
  bootrom: ElfImage;
  fullimage: ElfImage;
}

function parseImagePair(bootrom: ArrayBuffer, fullimage: ArrayBuffer): FirmwareImages {
  const images = { bootrom: parseElfImage(bootrom), fullimage: parseElfImage(fullimage) };
  if (images.bootrom.segments.length === 0 || images.fullimage.segments.length === 0) {
    throw new Error("Firmware contains no loadable segments");
  }
  return images;
}

export async function downloadFirmware(entry: FirmwareEntry): Promise<FirmwareImages> {
  // The API routes are stable and prevent a manifest from redirecting the app
  // to an unrelated host while still letting the server organize file storage.
  // Bundled packages live beside the page under the same id-based layout.
  const root =
    entry.source === "bundled"
      ? `${BUNDLED_FIRMWARE_PATH}/${encodeURIComponent(entry.id)}`
      : `${FIRMWARE_SOURCE}/api/firmware/${encodeURIComponent(entry.id)}`;
  const [bootrom, fullimage] = await Promise.all([
    downloadAndVerify(`${root}/bootrom.elf`, entry.checksums.bootloader_sha256),
    downloadAndVerify(`${root}/fullimage.elf`, entry.checksums.fullimage_sha256),
  ]);
  return parseImagePair(bootrom, fullimage);
}

/** Read a locally built `bootrom.elf` / `fullimage.elf` pair (e.g. from `make PLATFORM=PM5`). */
export async function readLocalFirmware(bootrom: File, fullimage: File): Promise<FirmwareImages> {
  const [bootromBuffer, fullimageBuffer] = await Promise.all([
    bootrom.arrayBuffer(),
    fullimage.arrayBuffer(),
  ]);
  return parseImagePair(bootromBuffer, fullimageBuffer);
}
