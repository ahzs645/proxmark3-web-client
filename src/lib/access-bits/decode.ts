import { DATA_BLOCK_ACCESS, TRAILER_ACCESS } from "./tables";
import { createDefaultSectorAccess } from "./helpers";
import type { AccessBitsResult, SectorAccess } from "./types";

function createInvalidResult(error: string): AccessBitsResult {
  return {
    valid: false,
    error,
    c0: 0,
    c1: 0,
    c2: 0,
    c3: 0,
    sectorAccess: createDefaultSectorAccess(),
  };
}

function toSectorAccess(values: [number, number, number, number]): SectorAccess {
  return {
    block0: DATA_BLOCK_ACCESS[values[0]],
    block1: DATA_BLOCK_ACCESS[values[1]],
    block2: DATA_BLOCK_ACCESS[values[2]],
    trailer: TRAILER_ACCESS[values[3]],
  };
}

/**
 * Decode 3 access bytes (6 hex chars) into access conditions.
 */
export function decodeAccessBits(hex: string): AccessBitsResult {
  const clean = hex.replace(/\s/g, "").toUpperCase();

  if (clean.length < 6) {
    return createInvalidResult("Access bits must be at least 3 bytes (6 hex chars)");
  }

  if (!/^[0-9A-F]+$/.test(clean)) {
    return createInvalidResult("Invalid hex characters");
  }

  const byte6 = Number.parseInt(clean.slice(0, 2), 16);
  const byte7 = Number.parseInt(clean.slice(2, 4), 16);
  const byte8 = Number.parseInt(clean.slice(4, 6), 16);

  const notC2 = (byte6 >> 4) & 0x0f;
  const notC1 = byte6 & 0x0f;
  const c1Nibble = (byte7 >> 4) & 0x0f;
  const notC3 = byte7 & 0x0f;
  const c3Nibble = (byte8 >> 4) & 0x0f;
  const c2Nibble = byte8 & 0x0f;

  const c1Valid = (notC1 ^ c1Nibble) === 0x0f;
  const c2Valid = (notC2 ^ c2Nibble) === 0x0f;
  const c3Valid = (notC3 ^ c3Nibble) === 0x0f;

  if (!c1Valid || !c2Valid || !c3Valid) {
    return createInvalidResult(
      `Parity error: ${!c1Valid ? "C1 " : ""}${!c2Valid ? "C2 " : ""}${!c3Valid ? "C3" : ""}`.trim(),
    );
  }

  const c: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const c1Bit = (c1Nibble >> i) & 1;
    const c2Bit = (c2Nibble >> i) & 1;
    const c3Bit = (c3Nibble >> i) & 1;
    c[i] = c1Bit | (c2Bit << 1) | (c3Bit << 2);
  }

  return {
    valid: true,
    c0: c[0],
    c1: c[1],
    c2: c[2],
    c3: c[3],
    sectorAccess: toSectorAccess(c),
  };
}
