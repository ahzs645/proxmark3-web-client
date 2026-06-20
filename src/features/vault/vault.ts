import type { CachedDump } from "@/components/panels/CardMemoryMap";
import type { StoredCard, StoredKey } from "@/components/panels/library/types";
import {
  CARDS_STORAGE_KEY,
  KEYS_STORAGE_KEY,
  loadStoredState,
} from "@/components/panels/library/utils";
import type { CachedAsset } from "@/features/key-cache/types";
import { sanitizeHex } from "@/lib/rfidUtils";

/**
 * The vault is the single read surface over the three data stores that used to
 * be queried independently all over the app: cached dumps (in-memory store),
 * cached files/assets (in-memory store), and the library's keys/cards
 * (localStorage). These helpers answer "what do I have for this card?" the same
 * way everywhere, so the target can carry a card's whole bundle in one place.
 */

function normalizeUid(uid: string): string {
  return sanitizeHex(uid, 20).toUpperCase();
}

/** Library keys that apply to a UID: those tagged for it plus untagged/global. */
export function keysForUid(uid: string, keys?: StoredKey[]): StoredKey[] {
  const target = normalizeUid(uid);
  if (!target) return [];
  const all = keys ?? loadStoredState<StoredKey[]>(KEYS_STORAGE_KEY, []);
  return all.filter((key) => {
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
}

/** Global counts across the whole vault, for headline stats. */
export function vaultStats(dumps: CachedDump[], assets: CachedAsset[]): VaultStats {
  return {
    cards: loadStoredState<StoredCard[]>(CARDS_STORAGE_KEY, []).length,
    keys: loadStoredState<StoredKey[]>(KEYS_STORAGE_KEY, []).length,
    dumps: dumps.length,
    files: assets.length,
  };
}
