export type StoredCard = {
  id: string;
  name: string;
  uid: string;
  type: string;
  sak?: string;
  atqa?: string;
  sourceDumpId?: string | null;
  favorite: boolean;
  notes: string;
  createdAt: number;
  updatedAt: number;
};

export type StoredKeyKind = "public" | "private" | "history";

export type StoredKey = {
  id: string;
  label: string;
  value: string;
  kind: StoredKeyKind;
  uidFilter: string;
  sourceDumpId?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type StoredDumpMeta = {
  dumpId: string;
  favorite: boolean;
  notes: string;
  updatedAt: number;
};

export type CardDraft = {
  id?: string;
  name: string;
  uid: string;
  type: string;
  sak: string;
  atqa: string;
  notes: string;
  favorite: boolean;
  sourceDumpId?: string | null;
};

export type KeyDraft = {
  id?: string;
  label: string;
  value: string;
  kind: StoredKeyKind;
  uidFilter: string;
  sourceDumpId?: string | null;
};

export type DumpDraft = {
  id: string;
  name: string;
  favorite: boolean;
  notes: string;
};

export type GroupedKeys = Record<StoredKeyKind, StoredKey[]>;

/**
 * Keys organized by where they came from, rather than by kind. Each recovered
 * autopwn/dump run becomes one "session" group tied to its card; keys tagged to
 * a UID with no surviving dump become a "card" group; everything untagged (the
 * common/default dictionary) collects in the single "common" group.
 */
export type KeyGroupKind = "session" | "card" | "common";

export type KeyGroup = {
  id: string;
  title: string;
  subtitle: string;
  /** Card UID the group's keys apply to ("" for the common group). */
  uid: string;
  /** Id of the dump this session's keys were recovered from, if it still exists. */
  sourceDumpId: string | null;
  kind: KeyGroupKind;
  keys: StoredKey[];
};
