import type { PM3DumpJson } from "@/components/panels/CardMemoryMap";
import type { CardDraft, KeyDraft, StoredCard, StoredKey } from "@/components/panels/library/types";
import {
  extractDumpKeysFromData,
  upsertCardRecord,
  upsertKeyRecord,
} from "@/components/panels/library/utils";
import { db, type AssetRecord, type DumpRecord } from "./db";
import { normalizeUid } from "./uid";

export function makeVaultId(prefix = "v"): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Dumps
// ---------------------------------------------------------------------------

/** Insert or replace a dump, fire-and-forget (callers hold the record already). */
export function putDump(record: DumpRecord): Promise<string> {
  return db.dumps.put(record);
}

export function deleteDump(id: string): Promise<void> {
  return db.dumps.delete(id);
}

export async function renameDump(id: string, name: string): Promise<void> {
  await db.dumps.update(id, { name, updatedAt: Date.now() });
}

/** Update the favorite/notes metadata that used to live in a separate store. */
export async function setDumpMeta(
  id: string,
  meta: { favorite?: boolean; notes?: string },
): Promise<void> {
  await db.dumps.update(id, { ...meta, updatedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/** Upsert a single key (handles UID-tagged dedup via upsertKeyRecord). */
export async function saveKey(draft: KeyDraft, existing: StoredKey[]): Promise<void> {
  await db.keys.bulkPut(upsertKeyRecord(existing, draft));
}

export function deleteKey(id: string): Promise<void> {
  return db.keys.delete(id);
}

/** Bulk import key drafts (default keys, dump-extracted keys), de-duplicated. */
export async function importKeyDrafts(drafts: KeyDraft[], existing: StoredKey[]): Promise<number> {
  if (!drafts.length) return 0;
  let next = existing;
  let imported = 0;
  for (const draft of drafts) {
    const before = next.length;
    next = upsertKeyRecord(next, draft);
    if (next.length > before) imported += 1;
  }
  // upsertKeyRecord never drops rows, so `next` is a superset — bulkPut is safe.
  await db.keys.bulkPut(next);
  return imported;
}

/** Extract the keys recovered in a dump and persist them to the library. */
export async function importDumpKeys(
  dump: PM3DumpJson | null | undefined,
  sourceDumpId?: string | null,
): Promise<number> {
  const drafts = extractDumpKeysFromData(dump, sourceDumpId);
  if (!drafts.length) return 0;
  const existing = await db.keys.toArray();
  return importKeyDrafts(drafts, existing);
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export async function saveCard(draft: CardDraft, existing: StoredCard[]): Promise<void> {
  await db.cards.bulkPut(upsertCardRecord(existing, draft));
}

export function deleteCard(id: string): Promise<void> {
  return db.cards.delete(id);
}

export async function setCardFavorite(id: string, favorite: boolean): Promise<void> {
  await db.cards.update(id, { favorite, updatedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// Assets (cached files)
// ---------------------------------------------------------------------------

/** Insert/replace a cached file, de-duplicated by its path/name like before. */
export async function putAsset(asset: AssetRecord): Promise<void> {
  const cacheKey = asset.relativePath || asset.name;
  const existing = await db.assets
    .filter((item) => (item.relativePath || item.name) === cacheKey)
    .first();
  await db.assets.put({ ...asset, id: existing?.id ?? asset.id });
}

export function deleteAsset(id: string): Promise<void> {
  return db.assets.delete(id);
}

export function clearAssets(): Promise<void> {
  return db.assets.clear();
}

export function normalizeDumpUid(dump: PM3DumpJson): string {
  return normalizeUid(dump.Card?.UID);
}
