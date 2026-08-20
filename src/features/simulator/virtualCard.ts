/**
 * Virtual cards for simulated mode.
 *
 * The default card is a real MIFARE Classic 4K capture (UID 84F0B240) plus the
 * HID Prox credential riding on its LF side — see {@link ./realCard}. State is
 * mutable and lives for the whole simulated session: `hf mf autopwn` marks keys
 * recovered, `hf mf wrbl` rewrites a block, and later reads/dumps see those
 * changes — the same way they would against physical hardware.
 */

import type { PM3DumpJson } from "@/features/memory/types";
import {
  REAL_CARD_ATQA,
  REAL_CARD_BLOCKS,
  REAL_CARD_KEYS,
  REAL_CARD_LF_HID,
  REAL_CARD_SAK,
  REAL_CARD_UID,
} from "./realCard";

export const DEFAULT_KEY = "FFFFFFFFFFFF";

export interface MifareSectorKeys {
  /** Key A for the sector, as 12 hex chars. */
  a: string;
  /** Key B for the sector, as 12 hex chars. */
  b: string;
}

export interface VirtualHfCard {
  kind: "mifare-1k" | "mifare-4k";
  uid: string;
  atqa: string;
  sak: string;
  /** Human label used in `hf search` output. */
  label: string;
  /** One 32-hex-char string per block, indexed by absolute block number. */
  blocks: string[];
  /** The card's real keys, indexed by sector number. */
  keys: MifareSectorKeys[];
  /**
   * Sectors whose keys this session has already recovered (via autopwn / chk).
   * Starts empty: a fresh card is uncracked until the user attacks it.
   */
  recovered: Set<number>;
}

export interface VirtualLfCard {
  kind: "hid";
  format: string;
  formatLabel: string;
  facilityCode: number;
  cardNumber: number;
  raw: string;
  t55xxBlock0: string;
}

export interface VirtualCardState {
  /** Whether any tag is presented to the reader. */
  present: boolean;
  hf: VirtualHfCard | null;
  lf: VirtualLfCard | null;
}

/** Blocks-per-sector is 4 for the first 32 sectors, 16 for the 8 high sectors (4K). */
export function sectorForBlock(block: number): number {
  if (block < 128) return Math.floor(block / 4);
  return 32 + Math.floor((block - 128) / 16);
}

export function firstBlockOfSector(sector: number): number {
  if (sector < 32) return sector * 4;
  return 128 + (sector - 32) * 16;
}

export function blocksInSector(sector: number): number {
  return sector < 32 ? 4 : 16;
}

export function trailerBlockOfSector(sector: number): number {
  return firstBlockOfSector(sector) + blocksInSector(sector) - 1;
}

export function sectorCount(kind: VirtualHfCard["kind"]): number {
  return kind === "mifare-4k" ? 40 : 16;
}

export function totalBlocks(kind: VirtualHfCard["kind"]): number {
  return kind === "mifare-4k" ? 256 : 64;
}

/** Build the real MIFARE Classic 4K card from the imported capture. */
function buildRealCard(): VirtualHfCard {
  return {
    kind: "mifare-4k",
    uid: REAL_CARD_UID,
    atqa: REAL_CARD_ATQA,
    sak: REAL_CARD_SAK,
    label: "MIFARE Classic 4K",
    blocks: [...REAL_CARD_BLOCKS],
    keys: REAL_CARD_KEYS.map((k) => ({ ...k })),
    recovered: new Set<number>(),
  };
}

/** A synthetic 1K card, for demonstrating a smaller / all-default tag. */
function buildBlankCard(): VirtualHfCard {
  const sectors = 16;
  const keys: MifareSectorKeys[] = Array.from({ length: sectors }, () => ({
    a: DEFAULT_KEY,
    b: DEFAULT_KEY,
  }));
  const blocks: string[] = [];
  for (let b = 0; b < 64; b++) {
    const s = sectorForBlock(b);
    if (b === 0) blocks.push("DEADBEEF220804000131204F3F6B0490");
    else if (b === trailerBlockOfSector(s)) blocks.push(`${DEFAULT_KEY}FF078069${DEFAULT_KEY}`);
    else blocks.push("00000000000000000000000000000000");
  }
  return {
    kind: "mifare-1k",
    uid: "DEADBEEF",
    atqa: "0004",
    sak: "08",
    label: "MIFARE Classic 1K",
    blocks,
    keys,
    recovered: new Set<number>(),
  };
}

export function buildDefaultLfCard(): VirtualLfCard {
  return {
    kind: "hid",
    format: REAL_CARD_LF_HID.format,
    formatLabel: REAL_CARD_LF_HID.formatLabel,
    facilityCode: REAL_CARD_LF_HID.facilityCode,
    cardNumber: REAL_CARD_LF_HID.cardNumber,
    raw: REAL_CARD_LF_HID.raw,
    t55xxBlock0: REAL_CARD_LF_HID.t55xxBlock0,
  };
}

/** The card the simulator starts a session with (the real 4K capture). */
export function buildInitialCardState(kind: VirtualHfCard["kind"] = "mifare-4k"): VirtualCardState {
  return {
    present: true,
    hf: kind === "mifare-1k" ? buildBlankCard() : buildRealCard(),
    lf: buildDefaultLfCard(),
  };
}

// --- dump / key serialization (matches what pm3 writes to disk) -------------

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

/** Raw card image: every block concatenated (1024 bytes for 1K, 4096 for 4K). */
export function toDumpBin(card: VirtualHfCard): Uint8Array {
  const out = new Uint8Array(card.blocks.length * 16);
  card.blocks.forEach((block, i) => out.set(hexToBytes(block), i * 16));
  return out;
}

/** PM3 key file: 40 (or 16) Key-A entries, then the Key-B entries, 6 bytes each. */
export function toKeyBin(card: VirtualHfCard): Uint8Array {
  const sectors = sectorCount(card.kind);
  const out = new Uint8Array(sectors * 6 * 2);
  for (let s = 0; s < sectors; s++) out.set(hexToBytes(card.keys[s].a), s * 6);
  for (let s = 0; s < sectors; s++) out.set(hexToBytes(card.keys[s].b), sectors * 6 + s * 6);
  return out;
}

/** The `.json` dump the app's library ingests (blocks + card identity + keys). */
export function toDumpJson(card: VirtualHfCard): PM3DumpJson {
  const blocks: Record<string, string> = {};
  card.blocks.forEach((data, i) => {
    blocks[String(i)] = data;
  });
  const SectorKeys: NonNullable<PM3DumpJson["SectorKeys"]> = {};
  for (let s = 0; s < sectorCount(card.kind); s++) {
    SectorKeys[String(s)] = { KeyA: card.keys[s].a, KeyB: card.keys[s].b };
  }
  return {
    Created: "proxmark3",
    FileType: "mfc v3",
    Card: { UID: card.uid, ATQA: card.atqa, SAK: card.sak },
    blocks,
    SectorKeys,
  };
}
