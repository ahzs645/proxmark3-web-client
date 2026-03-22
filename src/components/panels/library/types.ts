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
