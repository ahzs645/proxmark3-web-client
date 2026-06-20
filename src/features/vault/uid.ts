import { sanitizeHex } from "@/lib/rfidUtils";

/** Canonical UID form used as the vault's join key across all tables. */
export function normalizeUid(uid?: string | null): string {
  return sanitizeHex(uid || "", 20).toUpperCase();
}
