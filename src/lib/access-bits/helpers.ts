import { DATA_BLOCK_ACCESS, TRAILER_ACCESS } from "./tables";
import type { BlockAccess, Permission, SectorAccess, TrailerAccess } from "./types";

export function createDefaultSectorAccess(): SectorAccess {
  return {
    block0: DATA_BLOCK_ACCESS[0],
    block1: DATA_BLOCK_ACCESS[0],
    block2: DATA_BLOCK_ACCESS[0],
    trailer: TRAILER_ACCESS[1],
  };
}

export function getDataBlockAccess(condition: number): BlockAccess {
  return DATA_BLOCK_ACCESS[Math.max(0, Math.min(7, condition))];
}

export function getTrailerAccess(condition: number): TrailerAccess {
  return TRAILER_ACCESS[Math.max(0, Math.min(7, condition))];
}

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

export function isKeyBReadable(c3: number): boolean {
  return c3 <= 2;
}
