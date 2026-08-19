import type { PM3DumpJson } from "@/components/panels/CardMemoryMap";
import type { CardDraft, KeyDraft, StoredCard, StoredKey } from "@/components/panels/library/types";
import {
  extractDumpKeysFromData,
  upsertCardRecord,
  upsertKeyRecord,
} from "@/components/panels/library/utils";
import {
  db,
  type AssetRecord,
  type BackupRecord,
  type DumpRecord,
  type LfCardRecord,
  type OperationRecord,
  type VirtualCardForm,
  type VirtualCardMemberKind,
  type VirtualCardRecord,
  type VirtualCardRole,
} from "./db";
import { lfMatchKey } from "./lfIdentity";
import { normalizeUid } from "./uid";
import { memberId } from "./virtualCards";

// Re-exported so existing callers keep one import site for vault operations.
export { lfMatchKey };

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

export async function deleteDump(id: string): Promise<void> {
  await db.dumps.delete(id);
  await pruneVirtualCardMembers("dump", id);
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

export async function deleteKey(id: string): Promise<void> {
  await db.keys.delete(id);
  await pruneVirtualCardMembers("key", id);
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

export async function deleteCard(id: string): Promise<void> {
  await db.cards.delete(id);
  await pruneVirtualCardMembers("card", id);
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

export async function deleteAsset(id: string): Promise<void> {
  await db.assets.delete(id);
  await pruneVirtualCardMembers("asset", id);
}

export async function clearAssets(): Promise<void> {
  await db.assets.clear();
  await db.virtualCardMembers.where("kind").equals("asset").delete();
}

export function normalizeDumpUid(dump: PM3DumpJson): string {
  return normalizeUid(dump.Card?.UID);
}

// ---------------------------------------------------------------------------
// LF credentials
// ---------------------------------------------------------------------------

/** Insert or replace an LF credential row, fire-and-forget. */
export function putLfCard(record: LfCardRecord): Promise<string> {
  return db.lfCards.put(record);
}

export async function deleteLfCard(id: string): Promise<void> {
  await db.lfCards.delete(id);
  await pruneVirtualCardMembers("lfCard", id);
}

export async function renameLfCard(id: string, name: string): Promise<void> {
  await db.lfCards.update(id, { name, updatedAt: Date.now() });
}

export async function setLfCardMeta(
  id: string,
  meta: Partial<Pick<LfCardRecord, "favorite" | "notes" | "writable" | "chip" | "config">>,
): Promise<void> {
  await db.lfCards.update(id, { ...meta, updatedAt: Date.now() });
}

/**
 * Merge a freshly parsed LF read into the store. Cards are de-duplicated by
 * their identity (raw/format+FC+CN) so re-reading the same tag updates one row
 * instead of piling up duplicates, mirroring how HF dumps upsert by UID.
 */
export async function upsertLfCard(
  fields: Partial<LfCardRecord> & Pick<LfCardRecord, "tech">,
  matchKey: string,
): Promise<LfCardRecord> {
  const now = Date.now();
  const existing = matchKey
    ? await db.lfCards.filter((row) => lfMatchKey(row) === matchKey).first()
    : undefined;

  const record: LfCardRecord = existing
    ? { ...existing, ...fields, updatedAt: now }
    : {
        id: makeVaultId("lf"),
        name: fields.name ?? "LF card",
        uid: fields.uid ?? "",
        tech: fields.tech,
        format: fields.format,
        facilityCode: fields.facilityCode,
        cardNumber: fields.cardNumber,
        raw: fields.raw,
        fields: fields.fields,
        chip: fields.chip,
        config: fields.config,
        writable: fields.writable,
        cachedAt: now,
        favorite: false,
        notes: "",
        updatedAt: now,
      };

  await db.lfCards.put(record);
  return record;
}

// ---------------------------------------------------------------------------
// Operation audit trail
// ---------------------------------------------------------------------------

export function putOperation(record: OperationRecord): Promise<string> {
  return db.operations.put(record);
}

export function deleteOperation(id: string): Promise<void> {
  return db.operations.delete(id);
}

export function clearOperations(): Promise<void> {
  return db.operations.clear();
}

export function putBackup(record: BackupRecord): Promise<string> {
  return db.backups.put(record);
}

export function deleteBackup(id: string): Promise<void> {
  return db.backups.delete(id);
}

export function clearBackups(): Promise<void> {
  return db.backups.clear();
}

// ---------------------------------------------------------------------------
// Virtual cards
// ---------------------------------------------------------------------------

export interface VirtualCardDraft {
  id?: string;
  name: string;
  form: VirtualCardForm;
  role: VirtualCardRole;
  issuer: string;
  color: string;
  tags: string[];
  notes: string;
  favorite: boolean;
}

/** Create or update a virtual card, returning the row's id either way. */
export async function saveVirtualCard(draft: VirtualCardDraft): Promise<string> {
  const now = Date.now();
  const existing = draft.id ? await db.virtualCards.get(draft.id) : undefined;

  const record: VirtualCardRecord = {
    id: existing?.id ?? draft.id ?? makeVaultId("vcard"),
    name: draft.name.trim() || "Untitled card",
    form: draft.form,
    role: draft.role,
    issuer: draft.issuer.trim() || undefined,
    color: draft.color || undefined,
    tags: draft.tags,
    favorite: draft.favorite,
    notes: draft.notes,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await db.virtualCards.put(record);
  return record.id;
}

/** Delete a virtual card and every membership edge pointing at it. */
export async function deleteVirtualCard(id: string): Promise<void> {
  await db.transaction("rw", db.virtualCards, db.virtualCardMembers, async () => {
    await db.virtualCardMembers.where("virtualCardId").equals(id).delete();
    await db.virtualCards.delete(id);
  });
}

export async function setVirtualCardFavorite(id: string, favorite: boolean): Promise<void> {
  await db.virtualCards.update(id, { favorite, updatedAt: Date.now() });
}

/** Attach rows to a virtual card. Re-linking an existing member is a no-op. */
export async function linkVirtualCardMembers(
  virtualCardId: string,
  members: { kind: VirtualCardMemberKind; refId: string }[],
): Promise<void> {
  if (!members.length) return;
  const now = Date.now();

  await db.transaction("rw", db.virtualCards, db.virtualCardMembers, async () => {
    await db.virtualCardMembers.bulkPut(
      members.map((member) => ({
        id: memberId(virtualCardId, member.kind, member.refId),
        virtualCardId,
        kind: member.kind,
        refId: member.refId,
        addedAt: now,
      })),
    );
    await db.virtualCards.update(virtualCardId, { updatedAt: now });
  });
}

/**
 * Replace a virtual card's whole membership set (what the attach dialog saves).
 * Diffed rather than cleared-and-rewritten so `addedAt` survives on rows that
 * were already members.
 */
export async function setVirtualCardMembers(
  virtualCardId: string,
  members: { kind: VirtualCardMemberKind; refId: string }[],
): Promise<void> {
  const now = Date.now();
  const wanted = new Map(
    members.map((member) => [memberId(virtualCardId, member.kind, member.refId), member] as const),
  );

  await db.transaction("rw", db.virtualCards, db.virtualCardMembers, async () => {
    const current = await db.virtualCardMembers
      .where("virtualCardId")
      .equals(virtualCardId)
      .toArray();

    const removed = current.filter((edge) => !wanted.has(edge.id)).map((edge) => edge.id);
    const currentIds = new Set(current.map((edge) => edge.id));
    const added = [...wanted.entries()]
      .filter(([id]) => !currentIds.has(id))
      .map(([id, member]) => ({
        id,
        virtualCardId,
        kind: member.kind,
        refId: member.refId,
        addedAt: now,
      }));

    if (removed.length) await db.virtualCardMembers.bulkDelete(removed);
    if (added.length) await db.virtualCardMembers.bulkPut(added);
    if (removed.length || added.length) {
      await db.virtualCards.update(virtualCardId, { updatedAt: now });
    }
  });
}

/** Detach one row from a virtual card. */
export async function unlinkVirtualCardMember(
  virtualCardId: string,
  kind: VirtualCardMemberKind,
  refId: string,
): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", db.virtualCards, db.virtualCardMembers, async () => {
    await db.virtualCardMembers.delete(memberId(virtualCardId, kind, refId));
    await db.virtualCards.update(virtualCardId, { updatedAt: now });
  });
}

/**
 * Drop membership edges whose target row is gone. Called after a dump or key is
 * deleted so a virtual card never counts members that no longer exist.
 */
export async function pruneVirtualCardMembers(
  kind: VirtualCardMemberKind,
  refId: string,
): Promise<void> {
  await db.virtualCardMembers.where("[kind+refId]").equals([kind, refId]).delete();
}
