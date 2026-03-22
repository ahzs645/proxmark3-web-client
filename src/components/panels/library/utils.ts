import type { CachedDump } from "../CardMemoryMap";
import { sanitizeHex } from "@/lib/rfidUtils";
import type { CardDraft, KeyDraft, StoredCard, StoredKey } from "./types";

export const CARDS_STORAGE_KEY = "pm3-library-cards";
export const KEYS_STORAGE_KEY = "pm3-library-keys";
export const DUMPS_STORAGE_KEY = "pm3-library-dump-meta";

export function loadStoredState<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

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

  const duplicate = keys.find(
    (key) =>
      key.value === cleanValue &&
      key.uidFilter === cleanUid &&
      key.kind === draft.kind &&
      key.label === draft.label,
  );
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

export function getDumpUid(dump: CachedDump) {
  return sanitizeHex(dump.data.Card?.UID || "", 20);
}

export function extractDumpKeys(activeDump: CachedDump | null): KeyDraft[] {
  if (!activeDump?.data.SectorKeys) return [];

  const uidFilter = sanitizeHex(activeDump.data.Card?.UID || "", 20);
  const drafts: KeyDraft[] = [];

  Object.entries(activeDump.data.SectorKeys).forEach(([sector, keyData]) => {
    const keyA = sanitizeHex(keyData.KeyA || "", 12);
    const keyB = sanitizeHex(keyData.KeyB || "", 12);

    if (keyA && !keyA.includes("?")) {
      drafts.push({
        label: `Sector ${sector} Key A`,
        value: keyA,
        kind: "history",
        uidFilter,
        sourceDumpId: activeDump.id,
      });
    }

    if (keyB && !keyB.includes("?")) {
      drafts.push({
        label: `Sector ${sector} Key B`,
        value: keyB,
        kind: "history",
        uidFilter,
        sourceDumpId: activeDump.id,
      });
    }
  });

  return drafts;
}

export function exportDump(dump: CachedDump) {
  const blob = new Blob([JSON.stringify(dump.data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${dump.name.replace(/[^a-z0-9-_]+/gi, "_") || "pm3-dump"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
