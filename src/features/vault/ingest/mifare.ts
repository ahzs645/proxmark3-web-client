import type { PM3DumpJson, SectorKeysRecord } from "@/features/memory/types";
import { parseTrailer } from "@/features/memory/lib/trailer";

/**
 * Parsers for the MIFARE Classic side-files a `hf mf dump` run leaves behind.
 * The main `.bin`/`.json` dump is already handled by the memory importer; these
 * cover the companion key files and the human-readable hex listing, which
 * otherwise reach the vault as unparsable text.
 */

const KEY_BYTES = 6;

function cleanHex(value: string): string {
  return value.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Sector count implied by a Classic dump's block count (1K = 16, 4K = 40). */
export function sectorCountForBlocks(blockCount: number): number {
  if (blockCount >= 256) return 40;
  if (blockCount >= 64) return 16;
  return Math.max(1, Math.floor(blockCount / 4));
}

/** First block number of a sector (sectors 32+ on a 4K hold 16 blocks each). */
export function sectorFirstBlock(sector: number): number {
  return sector < 32 ? sector * 4 : 128 + (sector - 32) * 16;
}

/** Last block (the trailer) of a sector. */
export function sectorTrailerBlock(sector: number): number {
  return sector < 32 ? sector * 4 + 3 : 128 + (sector - 32) * 16 + 15;
}

/**
 * Parse a pm3 `hf-mf-<uid>-key.bin`: every sector's Key A in order, followed by
 * every sector's Key B. 96 bytes for a 1K (16 sectors), 480 for a 4K (40).
 */
export function parseMifareKeyBin(bytes: Uint8Array): SectorKeysRecord | null {
  if (bytes.length === 0 || bytes.length % (KEY_BYTES * 2) !== 0) return null;

  const sectors = bytes.length / (KEY_BYTES * 2);
  if (sectors !== 16 && sectors !== 40 && sectors !== 5) return null;

  const keys: SectorKeysRecord = {};
  for (let sector = 0; sector < sectors; sector += 1) {
    const offsetA = sector * KEY_BYTES;
    const offsetB = sectors * KEY_BYTES + sector * KEY_BYTES;
    keys[String(sector)] = {
      KeyA: bytesToHex(bytes.slice(offsetA, offsetA + KEY_BYTES)),
      KeyB: bytesToHex(bytes.slice(offsetB, offsetB + KEY_BYTES)),
    };
  }
  return keys;
}

/**
 * Parse the `hf mf dump` key table:
 *
 *   Sec | Key A        | Key B
 *   ----+--------------+--------------
 *     0 | FFFFFFFFFFFF | FFFFFFFFFFFF
 *
 * Unrecovered keys are printed by pm3 as `------------` or `?`; those are
 * skipped rather than stored, so a partial recovery imports what it has.
 */
export function parseMifareKeyTable(text: string): SectorKeysRecord | null {
  const keys: SectorKeysRecord = {};

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d{1,3})\s*\|\s*([0-9A-Fa-f?-]{12})\s*\|\s*([0-9A-Fa-f?-]{12})/);
    if (!match) continue;

    const keyA = cleanHex(match[2]);
    const keyB = cleanHex(match[3]);
    if (keyA.length !== 12 && keyB.length !== 12) continue;

    keys[String(Number(match[1]))] = {
      ...(keyA.length === 12 ? { KeyA: keyA } : {}),
      ...(keyB.length === 12 ? { KeyB: keyB } : {}),
    };
  }

  return Object.keys(keys).length ? keys : null;
}

/**
 * Parse the `hf-mf-<uid>-dump.hex.txt` listing pm3 writes alongside a dump:
 *
 *     0 | 84 F0 B2 40 86 98 02 00 E3 08 00 20 00 00 00 20
 *
 * The leading block number must be stripped before the hex is read, which is
 * exactly what trips the generic `.eml` importer on these files.
 */
export function parseHexBlockListing(text: string): Record<string, string> | null {
  const blocks: Record<string, string> = {};

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d{1,3})\s*[|:]\s*((?:[0-9A-Fa-f]{2}[\s]*){16})\s*$/);
    if (!match) continue;

    const hex = cleanHex(match[2]);
    if (hex.length !== 32) continue;
    blocks[String(Number(match[1]))] = hex;
  }

  const count = Object.keys(blocks).length;
  return count === 64 || count === 256 ? blocks : null;
}

/**
 * Recover the sector keys a Classic dump already carries in its trailer blocks.
 * A `.bin` import has no `SectorKeys` of its own, so without this the keys that
 * opened the card would be sitting in the dump yet invisible to the library.
 */
export function sectorKeysFromTrailers(blocks: Record<string, string>): SectorKeysRecord | null {
  const sectors = sectorCountForBlocks(Object.keys(blocks).length);
  const keys: SectorKeysRecord = {};

  for (let sector = 0; sector < sectors; sector += 1) {
    const trailer = blocks[String(sectorTrailerBlock(sector))];
    if (!trailer) continue;

    const parsed = parseTrailer(trailer);
    if (!parsed) continue;

    const keyA = cleanHex(parsed.keyA);
    const keyB = cleanHex(parsed.keyB);
    // pm3 writes all-zero trailers for sectors it could not read.
    if (/^0+$/.test(keyA) && /^0+$/.test(keyB)) continue;

    keys[String(sector)] = {
      KeyA: keyA,
      KeyB: keyB,
      AccessConditions: cleanHex(parsed.accessBits),
    };
  }

  return Object.keys(keys).length ? keys : null;
}

/** Merge sector keys into a dump, preferring keys already present on it. */
export function withSectorKeys(dump: PM3DumpJson, keys: SectorKeysRecord | null): PM3DumpJson {
  if (!keys) return dump;

  const merged: SectorKeysRecord = { ...keys };
  for (const [sector, existing] of Object.entries(dump.SectorKeys ?? {})) {
    merged[sector] = { ...merged[sector], ...existing };
  }
  return { ...dump, SectorKeys: merged };
}
