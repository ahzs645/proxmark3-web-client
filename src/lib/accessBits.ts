/**
 * MIFARE Classic Access Bits Utilities
 *
 * Access bits are stored in bytes 6-8 of the sector trailer.
 * Format: [~C2 ~C1] [C1 ~C3] [C3 C2] where each nibble contains bits for blocks 0-3
 *
 * Each block has a 3-bit access condition (C1, C2, C3) that determines permissions.
 */

export type Permission = "A" | "B" | "A|B" | "never";

export interface BlockAccess {
  read: Permission;
  write: Permission;
  increment: Permission;
  decrement: Permission; // Also includes transfer and restore
}

export interface TrailerAccess {
  keyARead: Permission;
  keyAWrite: Permission;
  accessBitsRead: Permission;
  accessBitsWrite: Permission;
  keyBRead: Permission;
  keyBWrite: Permission;
}

export interface SectorAccess {
  block0: BlockAccess;
  block1: BlockAccess;
  block2: BlockAccess;
  trailer: TrailerAccess;
}

export interface AccessBitsResult {
  valid: boolean;
  error?: string;
  c0: number; // 0-7, access condition for block 0
  c1: number; // 0-7, access condition for block 1
  c2: number; // 0-7, access condition for block 2
  c3: number; // 0-7, access condition for trailer
  sectorAccess: SectorAccess;
}

// Data block access conditions (C1 C2 C3 -> permissions)
// Index is the value of C1*1 + C2*2 + C3*4
const DATA_BLOCK_ACCESS: BlockAccess[] = [
  { read: "A|B", write: "A|B", increment: "A|B", decrement: "A|B" }, // 0: 000
  { read: "A|B", write: "never", increment: "never", decrement: "A|B" }, // 1: 001
  { read: "A|B", write: "never", increment: "never", decrement: "never" }, // 2: 010
  { read: "B", write: "B", increment: "never", decrement: "never" }, // 3: 011
  { read: "A|B", write: "B", increment: "never", decrement: "never" }, // 4: 100
  { read: "B", write: "never", increment: "never", decrement: "never" }, // 5: 101
  { read: "A|B", write: "B", increment: "B", decrement: "A|B" }, // 6: 110
  { read: "never", write: "never", increment: "never", decrement: "never" }, // 7: 111
];

// Trailer block access conditions
const TRAILER_ACCESS: TrailerAccess[] = [
  // 0: 000
  {
    keyARead: "never",
    keyAWrite: "A",
    accessBitsRead: "A",
    accessBitsWrite: "never",
    keyBRead: "A",
    keyBWrite: "A",
  },
  // 1: 001
  {
    keyARead: "never",
    keyAWrite: "A",
    accessBitsRead: "A",
    accessBitsWrite: "A",
    keyBRead: "A",
    keyBWrite: "A",
  },
  // 2: 010
  {
    keyARead: "never",
    keyAWrite: "never",
    accessBitsRead: "A",
    accessBitsWrite: "never",
    keyBRead: "A",
    keyBWrite: "never",
  },
  // 3: 011
  {
    keyARead: "never",
    keyAWrite: "B",
    accessBitsRead: "A|B",
    accessBitsWrite: "B",
    keyBRead: "never",
    keyBWrite: "B",
  },
  // 4: 100
  {
    keyARead: "never",
    keyAWrite: "B",
    accessBitsRead: "A|B",
    accessBitsWrite: "never",
    keyBRead: "never",
    keyBWrite: "B",
  },
  // 5: 101
  {
    keyARead: "never",
    keyAWrite: "never",
    accessBitsRead: "A|B",
    accessBitsWrite: "B",
    keyBRead: "never",
    keyBWrite: "never",
  },
  // 6: 110
  {
    keyARead: "never",
    keyAWrite: "never",
    accessBitsRead: "A|B",
    accessBitsWrite: "never",
    keyBRead: "never",
    keyBWrite: "never",
  },
  // 7: 111
  {
    keyARead: "never",
    keyAWrite: "never",
    accessBitsRead: "A|B",
    accessBitsWrite: "never",
    keyBRead: "never",
    keyBWrite: "never",
  },
];

/**
 * Decode 3 access bytes (6 hex chars) into access conditions
 * @param hex Access bytes as hex string (e.g., "FF0780" or "FF 07 80")
 */
export function decodeAccessBits(hex: string): AccessBitsResult {
  // Remove spaces and validate
  const clean = hex.replace(/\s/g, "").toUpperCase();

  if (clean.length < 6) {
    return {
      valid: false,
      error: "Access bits must be at least 3 bytes (6 hex chars)",
      c0: 0,
      c1: 0,
      c2: 0,
      c3: 0,
      sectorAccess: getDefaultSectorAccess(),
    };
  }

  if (!/^[0-9A-F]+$/.test(clean)) {
    return {
      valid: false,
      error: "Invalid hex characters",
      c0: 0,
      c1: 0,
      c2: 0,
      c3: 0,
      sectorAccess: getDefaultSectorAccess(),
    };
  }

  // Parse the 3 bytes
  const byte6 = parseInt(clean.slice(0, 2), 16);
  const byte7 = parseInt(clean.slice(2, 4), 16);
  const byte8 = parseInt(clean.slice(4, 6), 16);

  // Extract nibbles
  // Byte 6: [~C2_3 ~C2_2 ~C2_1 ~C2_0] [~C1_3 ~C1_2 ~C1_1 ~C1_0]
  // Byte 7: [C1_3 C1_2 C1_1 C1_0] [~C3_3 ~C3_2 ~C3_1 ~C3_0]
  // Byte 8: [C3_3 C3_2 C3_1 C3_0] [C2_3 C2_2 C2_1 C2_0]
  const notC2 = (byte6 >> 4) & 0x0f;
  const notC1 = byte6 & 0x0f;
  const c1Nibble = (byte7 >> 4) & 0x0f;
  const notC3 = byte7 & 0x0f;
  const c3Nibble = (byte8 >> 4) & 0x0f;
  const c2Nibble = byte8 & 0x0f;

  // Validate parity (complement bits should match)
  const c1Valid = (notC1 ^ c1Nibble) === 0x0f;
  const c2Valid = (notC2 ^ c2Nibble) === 0x0f;
  const c3Valid = (notC3 ^ c3Nibble) === 0x0f;

  if (!c1Valid || !c2Valid || !c3Valid) {
    return {
      valid: false,
      error: `Parity error: ${!c1Valid ? "C1 " : ""}${!c2Valid ? "C2 " : ""}${!c3Valid ? "C3" : ""}`.trim(),
      c0: 0,
      c1: 0,
      c2: 0,
      c3: 0,
      sectorAccess: getDefaultSectorAccess(),
    };
  }

  // Extract individual block access conditions
  // For each block i, Cx_i is bit i of the Cx nibble
  const c = [0, 0, 0, 0]; // c[0] = block 0, c[3] = trailer
  for (let i = 0; i < 4; i++) {
    const c1Bit = (c1Nibble >> i) & 1;
    const c2Bit = (c2Nibble >> i) & 1;
    const c3Bit = (c3Nibble >> i) & 1;
    c[i] = c1Bit | (c2Bit << 1) | (c3Bit << 2);
  }

  const sectorAccess: SectorAccess = {
    block0: DATA_BLOCK_ACCESS[c[0]],
    block1: DATA_BLOCK_ACCESS[c[1]],
    block2: DATA_BLOCK_ACCESS[c[2]],
    trailer: TRAILER_ACCESS[c[3]],
  };

  return {
    valid: true,
    c0: c[0],
    c1: c[1],
    c2: c[2],
    c3: c[3],
    sectorAccess,
  };
}

/**
 * Encode access conditions into 3 access bytes
 * @param c0 Access condition for block 0 (0-7)
 * @param c1 Access condition for block 1 (0-7)
 * @param c2 Access condition for block 2 (0-7)
 * @param c3 Access condition for trailer (0-7)
 */
export function encodeAccessBits(c0: number, c1: number, c2: number, c3: number): string {
  // Clamp values to 0-7
  c0 = Math.max(0, Math.min(7, c0));
  c1 = Math.max(0, Math.min(7, c1));
  c2 = Math.max(0, Math.min(7, c2));
  c3 = Math.max(0, Math.min(7, c3));

  // Build nibbles
  let c1Nibble = 0;
  let c2Nibble = 0;
  let c3Nibble = 0;

  for (let i = 0; i < 4; i++) {
    const cVal = [c0, c1, c2, c3][i];
    const c1Bit = cVal & 1;
    const c2Bit = (cVal >> 1) & 1;
    const c3Bit = (cVal >> 2) & 1;
    c1Nibble |= c1Bit << i;
    c2Nibble |= c2Bit << i;
    c3Nibble |= c3Bit << i;
  }

  // Build bytes with complements
  const notC1 = (~c1Nibble) & 0x0f;
  const notC2 = (~c2Nibble) & 0x0f;
  const notC3 = (~c3Nibble) & 0x0f;

  const byte6 = (notC2 << 4) | notC1;
  const byte7 = (c1Nibble << 4) | notC3;
  const byte8 = (c3Nibble << 4) | c2Nibble;

  return byte6.toString(16).padStart(2, "0").toUpperCase() +
    byte7.toString(16).padStart(2, "0").toUpperCase() +
    byte8.toString(16).padStart(2, "0").toUpperCase();
}

/**
 * Validate access bits hex string
 */
export function validateAccessBits(hex: string): boolean {
  return decodeAccessBits(hex).valid;
}

/**
 * Get default sector access (transport configuration)
 */
export function getDefaultSectorAccess(): SectorAccess {
  return {
    block0: DATA_BLOCK_ACCESS[0],
    block1: DATA_BLOCK_ACCESS[0],
    block2: DATA_BLOCK_ACCESS[0],
    trailer: TRAILER_ACCESS[1],
  };
}

/**
 * Get data block access for a given condition value
 */
export function getDataBlockAccess(condition: number): BlockAccess {
  return DATA_BLOCK_ACCESS[Math.max(0, Math.min(7, condition))];
}

/**
 * Get trailer access for a given condition value
 */
export function getTrailerAccess(condition: number): TrailerAccess {
  return TRAILER_ACCESS[Math.max(0, Math.min(7, condition))];
}

/**
 * Get human-readable description of permission
 */
export function permissionToString(perm: Permission): string {
  switch (perm) {
    case "A":
      return "Key A";
    case "B":
      return "Key B";
    case "A|B":
      return "Key A or B";
    case "never":
      return "Never";
  }
}

/**
 * Check if Key B is readable (which means it can't be used for auth)
 */
export function isKeyBReadable(c3: number): boolean {
  // Key B is readable when C3 = 0, 1, or 2
  return c3 <= 2;
}

/**
 * Preset access configurations
 */
export const ACCESS_PRESETS = {
  transport: {
    label: "Transport",
    description: "Factory default - all blocks readable/writable with Key A or B",
    c0: 0,
    c1: 0,
    c2: 0,
    c3: 1,
    hex: "FF0780",
  },
  keyBProtected: {
    label: "Key B Protected",
    description: "Key B can't be read, used for higher security",
    c0: 0,
    c1: 0,
    c2: 0,
    c3: 3,
    hex: "7F0788",
  },
  readOnly: {
    label: "Read Only",
    description: "Data blocks can only be read, not written",
    c0: 2,
    c1: 2,
    c2: 2,
    c3: 1,
    hex: "078F00",
  },
  valueBlock: {
    label: "Value Block",
    description: "Optimized for value operations (increment/decrement)",
    c0: 6,
    c1: 6,
    c2: 6,
    c3: 3,
    hex: "08778F",
  },
  locked: {
    label: "Locked",
    description: "No operations possible - IRREVERSIBLE!",
    c0: 7,
    c1: 7,
    c2: 7,
    c3: 7,
    hex: "000000",
  },
} as const;

export type AccessPresetKey = keyof typeof ACCESS_PRESETS;
