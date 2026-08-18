import type { CachedDump } from "@/components/panels/CardMemoryMap";
import type { StoredKey } from "@/components/panels/library/types";
import type { CachedAsset } from "@/features/key-cache/types";
import { normalizeUid } from "./uid";

/**
 * Pure "what do I have for this card?" helpers over already-loaded vault data.
 * The records come from the Dexie-backed live queries (see hooks.ts); these
 * functions just filter the arrays so every caller matches a card the same way.
 */

/** Library keys that apply to a UID: those tagged for it plus untagged/global. */
export function keysForUid(uid: string, keys: StoredKey[]): StoredKey[] {
  const target = normalizeUid(uid);
  if (!target) return [];
  return keys.filter((key) => {
    const filter = normalizeUid(key.uidFilter || "");
    return !filter || filter === target;
  });
}

/** Cached dumps whose card UID matches. */
export function dumpsForUid(uid: string, dumps: CachedDump[]): CachedDump[] {
  const target = normalizeUid(uid);
  if (!target) return [];
  return dumps.filter((dump) => normalizeUid(dump.data.Card?.UID || "") === target);
}

/** Cached files whose filename references the UID (e.g. hf-mf-<uid>-dump.json). */
export function assetsForUid(uid: string, assets: CachedAsset[]): CachedAsset[] {
  const target = normalizeUid(uid).toLowerCase();
  if (!target) return [];
  return assets.filter((asset) =>
    `${asset.relativePath || ""} ${asset.name}`.toLowerCase().includes(target),
  );
}

export interface VaultStats {
  cards: number;
  keys: number;
  dumps: number;
  files: number;
  operations: number;
}

/** Headline counts across the whole vault, computed from the live arrays. */
export function vaultStats(
  dumps: unknown[],
  assets: unknown[],
  keys: unknown[],
  cards: unknown[],
  lfCards: unknown[] = [],
  operations: unknown[] = [],
): VaultStats {
  return {
    cards: cards.length + lfCards.length,
    keys: keys.length,
    dumps: dumps.length,
    files: assets.length,
    operations: operations.length,
  };
}
