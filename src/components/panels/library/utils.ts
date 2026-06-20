import type { CachedDump, PM3DumpJson } from "../CardMemoryMap";
import { sanitizeHex } from "@/lib/rfidUtils";
import { exportDumpJson } from "@/features/memory/lib/export";
import type { CardDraft, KeyDraft, StoredCard, StoredKey } from "./types";

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function copyText(value: string) {
  void navigator.clipboard.writeText(value);
}

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

export function defaultCardName(uid: string, type: string) {
  return type ? `${type} ${uid.slice(0, 4)}` : `Card ${uid.slice(0, 8)}`;
}

export function upsertCardRecord(cards: StoredCard[], draft: CardDraft): StoredCard[] {
  const now = Date.now();
  const cleanUid = sanitizeHex(draft.uid, 20);
  const existing = cards.find((card) => card.uid === cleanUid || card.id === draft.id);

  if (existing) {
    const updated: StoredCard = {
      ...existing,
      name: draft.name || existing.name,
      uid: cleanUid || existing.uid,
      type: draft.type || existing.type,
      sak: sanitizeHex(draft.sak, 2) || existing.sak,
      atqa: sanitizeHex(draft.atqa, 4) || existing.atqa,
      sourceDumpId: draft.sourceDumpId ?? existing.sourceDumpId ?? null,
      notes: draft.notes,
      favorite: draft.favorite,
      updatedAt: now,
    };

    return [updated, ...cards.filter((card) => card.id !== existing.id)];
  }

  return [
    {
      id: draft.id || makeId("card"),
      name: draft.name || defaultCardName(cleanUid, draft.type),
      uid: cleanUid,
      type: draft.type,
      sak: sanitizeHex(draft.sak, 2),
      atqa: sanitizeHex(draft.atqa, 4),
      sourceDumpId: draft.sourceDumpId ?? null,
      favorite: draft.favorite,
      notes: draft.notes,
      createdAt: now,
      updatedAt: now,
    },
    ...cards,
  ];
}

export function upsertKeyRecord(keys: StoredKey[], draft: KeyDraft): StoredKey[] {
  const now = Date.now();
  const cleanValue = sanitizeHex(draft.value, 12);
  const cleanUid = sanitizeHex(draft.uidFilter, 20);
  const existing = keys.find((key) => key.id === draft.id);

  if (existing) {
    const updated: StoredKey = {
      ...existing,
      label: draft.label,
      value: cleanValue,
      kind: draft.kind,
      uidFilter: cleanUid,
      sourceDumpId: draft.sourceDumpId ?? existing.sourceDumpId ?? null,
      updatedAt: now,
    };

    return [updated, ...keys.filter((key) => key.id !== existing.id)];
  }

  const duplicate = keys.find((key) => matchesKeyDraft(key, draft, cleanValue, cleanUid));
  if (duplicate) {
    return [{ ...duplicate, updatedAt: now }, ...keys.filter((key) => key.id !== duplicate.id)];
  }

  return [
    {
      id: draft.id || makeId("key"),
      label: draft.label,
      value: cleanValue,
      kind: draft.kind,
      uidFilter: cleanUid,
      sourceDumpId: draft.sourceDumpId ?? null,
      createdAt: now,
      updatedAt: now,
    },
    ...keys,
  ];
}

function matchesKeyDraft(
  key: StoredKey,
  draft: KeyDraft,
  cleanValue = sanitizeHex(draft.value, 12),
  cleanUid = sanitizeHex(draft.uidFilter, 20),
) {
  return (
    key.value === cleanValue &&
    key.uidFilter === cleanUid &&
    key.kind === draft.kind &&
    (key.label === draft.label ||
      (draft.sourceDumpId != null &&
        draft.sourceDumpId !== "" &&
        key.sourceDumpId === draft.sourceDumpId))
  );
}

export function getDumpUid(dump: CachedDump) {
  return sanitizeHex(dump.data.Card?.UID || "", 20);
}

export function extractDumpKeysFromData(
  dump: PM3DumpJson | null | undefined,
  sourceDumpId?: string | null,
): KeyDraft[] {
  if (!dump?.SectorKeys) return [];

  const uidFilter = sanitizeHex(dump.Card?.UID || "", 20);
  const drafts: KeyDraft[] = [];

  Object.entries(dump.SectorKeys).forEach(([sector, keyData]) => {
    const keyA = sanitizeHex(keyData.KeyA || "", 12);
    const keyB = sanitizeHex(keyData.KeyB || "", 12);

    if (keyA && !keyA.includes("?")) {
      drafts.push({
        label: `Sector ${sector} Key A`,
        value: keyA,
        kind: "history",
        uidFilter,
        sourceDumpId: sourceDumpId ?? null,
      });
    }

    if (keyB && !keyB.includes("?")) {
      drafts.push({
        label: `Sector ${sector} Key B`,
        value: keyB,
        kind: "history",
        uidFilter,
        sourceDumpId: sourceDumpId ?? null,
      });
    }
  });

  return drafts;
}

export function extractDumpKeys(activeDump: CachedDump | null): KeyDraft[] {
  return extractDumpKeysFromData(activeDump?.data, activeDump?.id ?? null);
}

export function exportDump(dump: CachedDump) {
  exportDumpJson(dump);
}

export function exportStoredKeys(keys: StoredKey[]) {
  const payload = {
    exportedAt: new Date().toISOString(),
    count: keys.length,
    keys,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "pm3-library-keys.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Build a Proxmark3 key dictionary (one 12-hex key per line) from stored keys,
 * for use with `hf mf autopwn/chk -f <file>`. Includes keys tagged for the
 * given UID plus untagged/global keys, de-duplicated. Returns "" if none.
 */
export function buildKeyDictionary(keys: StoredKey[], uid?: string): string {
  const cleanUid = sanitizeHex(uid || "", 20);
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const key of keys) {
    if (cleanUid && key.uidFilter && key.uidFilter !== cleanUid) continue;
    const value = sanitizeHex(key.value, 12).toUpperCase();
    if (value.length !== 12 || value.includes("?") || seen.has(value)) continue;
    seen.add(value);
    lines.push(value);
  }

  return lines.join("\n");
}
