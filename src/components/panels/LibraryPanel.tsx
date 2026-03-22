import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TagInfo } from "./TagInfoPanel";
import type { CachedDump, PM3DumpJson } from "./CardMemoryMap";
import { DEFAULT_MIFARE_KEYS, sanitizeHex } from "@/lib/rfidUtils";
import {
  Clock,
  Copy,
  CreditCard,
  Download,
  Edit3,
  FileText,
  FolderOpen,
  HardDrive,
  KeyRound,
  Plus,
  Search,
  Shield,
  Star,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StoredCard = {
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

type StoredKeyKind = "public" | "private" | "history";

type StoredKey = {
  id: string;
  label: string;
  value: string;
  kind: StoredKeyKind;
  uidFilter: string;
  sourceDumpId?: string | null;
  createdAt: number;
  updatedAt: number;
};

type StoredDumpMeta = {
  dumpId: string;
  favorite: boolean;
  notes: string;
  updatedAt: number;
};

type CardDraft = {
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

type KeyDraft = {
  id?: string;
  label: string;
  value: string;
  kind: StoredKeyKind;
  uidFilter: string;
  sourceDumpId?: string | null;
};

type DumpDraft = {
  id: string;
  name: string;
  favorite: boolean;
  notes: string;
};

interface LibraryPanelProps {
  currentTag: TagInfo | null;
  activeDump: CachedDump | null;
  cachedDumps: CachedDump[];
  onDumpLoad?: (dump: PM3DumpJson, name: string) => void;
  onDumpRename?: (id: string, newName: string) => void;
  onDumpDelete?: (id: string) => void;
}

const CARDS_STORAGE_KEY = "pm3-library-cards";
const KEYS_STORAGE_KEY = "pm3-library-keys";
const DUMPS_STORAGE_KEY = "pm3-library-dump-meta";

function loadStoredState<T>(key: string, fallback: T): T {
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

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

function defaultCardName(uid: string, type: string) {
  return type ? `${type} ${uid.slice(0, 4)}` : `Card ${uid.slice(0, 8)}`;
}

function upsertCardRecord(cards: StoredCard[], draft: CardDraft): StoredCard[] {
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

function upsertKeyRecord(keys: StoredKey[], draft: KeyDraft): StoredKey[] {
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

function getDumpUid(dump: CachedDump) {
  return sanitizeHex(dump.data.Card?.UID || "", 20);
}

function extractDumpKeys(activeDump: CachedDump | null): KeyDraft[] {
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

function exportDump(dump: CachedDump) {
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

function copyText(value: string) {
  void navigator.clipboard.writeText(value);
}

function NotesPreview({ text }: { text: string }) {
  if (!text.trim()) return null;

  return <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{text}</p>;
}

export function LibraryPanel({
  currentTag,
  activeDump,
  cachedDumps,
  onDumpLoad,
  onDumpRename,
  onDumpDelete,
}: LibraryPanelProps) {
  const [cards, setCards] = useState<StoredCard[]>(() => loadStoredState(CARDS_STORAGE_KEY, []));
  const [keys, setKeys] = useState<StoredKey[]>(() => loadStoredState(KEYS_STORAGE_KEY, []));
  const [dumpMeta, setDumpMeta] = useState<StoredDumpMeta[]>(() =>
    loadStoredState(DUMPS_STORAGE_KEY, []),
  );

  const [cardSearch, setCardSearch] = useState("");
  const [keySearch, setKeySearch] = useState("");
  const [dumpSearch, setDumpSearch] = useState("");

  const [cardDraft, setCardDraft] = useState<CardDraft | null>(null);
  const [keyDraft, setKeyDraft] = useState<KeyDraft | null>(null);
  const [dumpDraft, setDumpDraft] = useState<DumpDraft | null>(null);

  useEffect(() => {
    localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(cards));
  }, [cards]);

  useEffect(() => {
    localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(keys));
  }, [keys]);

  useEffect(() => {
    localStorage.setItem(DUMPS_STORAGE_KEY, JSON.stringify(dumpMeta));
  }, [dumpMeta]);

  const dumpMetaMap = useMemo(
    () => new Map(dumpMeta.map((meta) => [meta.dumpId, meta])),
    [dumpMeta],
  );
  const dumpMap = useMemo(() => new Map(cachedDumps.map((dump) => [dump.id, dump])), [cachedDumps]);

  const filteredCards = useMemo(() => {
    const filter = cardSearch.trim().toUpperCase();
    const next = [...cards].sort((a, b) => {
      if (a.favorite !== b.favorite) return Number(b.favorite) - Number(a.favorite);
      return b.updatedAt - a.updatedAt;
    });

    if (!filter) return next;

    return next.filter((card) =>
      [card.name, card.uid, card.type, card.notes].some((value) =>
        value.toUpperCase().includes(filter),
      ),
    );
  }, [cardSearch, cards]);

  const filteredKeys = useMemo(() => {
    const filter = keySearch.trim().toUpperCase();
    const next = [...keys].sort((a, b) => b.updatedAt - a.updatedAt);

    if (!filter) return next;

    return next.filter((key) =>
      [key.label, key.value, key.uidFilter].some((value) => value.toUpperCase().includes(filter)),
    );
  }, [keySearch, keys]);

  const groupedKeys = useMemo(
    () => ({
      public: filteredKeys.filter((key) => key.kind === "public"),
      private: filteredKeys.filter((key) => key.kind === "private"),
      history: filteredKeys.filter((key) => key.kind === "history"),
    }),
    [filteredKeys],
  );

  const filteredDumps = useMemo(() => {
    const filter = dumpSearch.trim().toUpperCase();
    const next = [...cachedDumps].sort((a, b) => {
      const aFavorite = dumpMetaMap.get(a.id)?.favorite ?? false;
      const bFavorite = dumpMetaMap.get(b.id)?.favorite ?? false;
      if (aFavorite !== bFavorite) return Number(bFavorite) - Number(aFavorite);
      return b.cachedAt - a.cachedAt;
    });

    if (!filter) return next;

    return next.filter((dump) => {
      const meta = dumpMetaMap.get(dump.id);
      return [dump.name, dump.data.Card?.UID || "", meta?.notes || ""].some((value) =>
        value.toUpperCase().includes(filter),
      );
    });
  }, [cachedDumps, dumpMetaMap, dumpSearch]);

  const currentTagCardDraft = useMemo<CardDraft | null>(() => {
    if (!currentTag?.uid) return null;

    const uid = sanitizeHex(currentTag.uid, 20);
    return {
      name: defaultCardName(uid, currentTag.type || ""),
      uid,
      type: currentTag.type || "",
      sak: sanitizeHex(currentTag.sak || "", 2),
      atqa: sanitizeHex(currentTag.atqa || "", 4),
      favorite: false,
      notes: "",
    };
  }, [currentTag]);

  const activeDumpCardDraft = useMemo<CardDraft | null>(() => {
    if (!activeDump?.data.Card?.UID) return null;

    const uid = sanitizeHex(activeDump.data.Card.UID, 20);
    return {
      name: activeDump.name,
      uid,
      type: activeDump.data.FileType || activeDump.data.Card?.UID || "Dump",
      sak: sanitizeHex(activeDump.data.Card?.SAK || "", 2),
      atqa: sanitizeHex(activeDump.data.Card?.ATQA || "", 4),
      favorite: false,
      notes: "",
      sourceDumpId: activeDump.id,
    };
  }, [activeDump]);

  const importDefaultKeys = () => {
    setKeys((prev) =>
      DEFAULT_MIFARE_KEYS.reduce(
        (items, value) =>
          upsertKeyRecord(items, {
            label: `Common ${value}`,
            value,
            kind: "public",
            uidFilter: "",
          }),
        prev,
      ),
    );
  };

  const importActiveDumpKeys = () => {
    const drafts = extractDumpKeys(activeDump);
    if (!drafts.length) return;

    setKeys((prev) => drafts.reduce((items, draft) => upsertKeyRecord(items, draft), prev));
  };

  const openCardEditor = (card?: StoredCard | CardDraft | null) => {
    if (!card) return;

    setCardDraft({
      id: "id" in card ? card.id : undefined,
      name: card.name || "",
      uid: sanitizeHex(card.uid || "", 20),
      type: card.type || "",
      sak: sanitizeHex(card.sak || "", 2),
      atqa: sanitizeHex(card.atqa || "", 4),
      notes: card.notes || "",
      favorite: card.favorite || false,
      sourceDumpId: card.sourceDumpId ?? null,
    });
  };

  const openKeyEditor = (key?: StoredKey | KeyDraft | null) => {
    setKeyDraft({
      id: key && "id" in key ? key.id : undefined,
      label: key?.label || "",
      value: sanitizeHex(key?.value || "", 12),
      kind: key?.kind || "private",
      uidFilter: sanitizeHex(key?.uidFilter || "", 20),
      sourceDumpId: key?.sourceDumpId ?? null,
    });
  };

  const openDumpEditor = (dump: CachedDump) => {
    const meta = dumpMetaMap.get(dump.id);
    setDumpDraft({
      id: dump.id,
      name: dump.name,
      favorite: meta?.favorite || false,
      notes: meta?.notes || "",
    });
  };

  const saveCardDraft = () => {
    if (!cardDraft) return;
    if (!sanitizeHex(cardDraft.uid, 20)) return;

    setCards((prev) => upsertCardRecord(prev, cardDraft));
    setCardDraft(null);
  };

  const saveKeyDraft = () => {
    if (!keyDraft) return;
    if (sanitizeHex(keyDraft.value, 12).length !== 12) return;

    setKeys((prev) => upsertKeyRecord(prev, keyDraft));
    setKeyDraft(null);
  };

  const saveDumpDraft = () => {
    if (!dumpDraft) return;

    setDumpMeta((prev) => {
      const existing = prev.find((meta) => meta.dumpId === dumpDraft.id);
      const nextMeta: StoredDumpMeta = {
        dumpId: dumpDraft.id,
        favorite: dumpDraft.favorite,
        notes: dumpDraft.notes,
        updatedAt: Date.now(),
      };

      return existing
        ? [nextMeta, ...prev.filter((meta) => meta.dumpId !== dumpDraft.id)]
        : [nextMeta, ...prev];
    });

    const dump = dumpMap.get(dumpDraft.id);
    if (dump && dumpDraft.name.trim() && dumpDraft.name.trim() !== dump.name) {
      onDumpRename?.(dumpDraft.id, dumpDraft.name.trim());
    }

    setDumpDraft(null);
  };

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-primary" />
          Browser Library
          <Badge variant="outline">Local Only</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="cards" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="cards">Cards</TabsTrigger>
              <TabsTrigger value="keys">Keys</TabsTrigger>
              <TabsTrigger value="dumps">Dumps</TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{cards.length} cards</Badge>
              <Badge variant="secondary">{keys.length} keys</Badge>
              <Badge variant="secondary">{cachedDumps.length} dumps</Badge>
            </div>
          </div>

          <TabsContent value="cards" className="m-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={cardSearch}
                  onChange={(e) => setCardSearch(e.target.value)}
                  placeholder="Search cards, UID, notes..."
                  className="pl-9"
                />
              </div>
              <Button
                size="sm"
                onClick={() => openCardEditor(currentTagCardDraft)}
                disabled={!currentTagCardDraft}
              >
                <Plus className="h-3 w-3 mr-1" />
                Save Current Tag
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openCardEditor(activeDumpCardDraft)}
                disabled={!activeDumpCardDraft}
              >
                <HardDrive className="h-3 w-3 mr-1" />
                Save Active Dump
              </Button>
            </div>

            <div className="space-y-3">
              {filteredCards.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  Save the current tag or an active dump to build a local browser card library.
                </div>
              ) : (
                filteredCards.map((card) => {
                  const sourceDump = card.sourceDumpId ? dumpMap.get(card.sourceDumpId) : null;

                  return (
                    <div key={card.id} className="rounded-xl border bg-card/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold">{card.name}</h3>
                            {card.favorite ? <Badge variant="warning">Favorite</Badge> : null}
                            <Badge variant="outline">{card.type || "Unknown"}</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="font-mono text-foreground">{card.uid}</span>
                            {card.sak ? <span>SAK {card.sak}</span> : null}
                            {card.atqa ? <span>ATQA {card.atqa}</span> : null}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {relativeTime(card.updatedAt)}
                            </span>
                          </div>
                          <NotesPreview text={card.notes} />
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant={card.favorite ? "default" : "ghost"}
                            className="h-8 w-8 p-0"
                            onClick={() =>
                              setCards((prev) =>
                                prev.map((entry) =>
                                  entry.id === card.id
                                    ? { ...entry, favorite: !entry.favorite, updatedAt: Date.now() }
                                    : entry,
                                ),
                              )
                            }
                          >
                            <Star className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => copyText(card.uid)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => openCardEditor(card)}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                            onClick={() =>
                              setCards((prev) => prev.filter((entry) => entry.id !== card.id))
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {sourceDump ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onDumpLoad?.(sourceDump.data, sourceDump.name)}
                          >
                            <FolderOpen className="h-3 w-3 mr-1" />
                            Open Source Dump
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="keys" className="m-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={keySearch}
                  onChange={(e) => setKeySearch(e.target.value)}
                  placeholder="Search keys, label, UID..."
                  className="pl-9"
                />
              </div>
              <Button size="sm" onClick={() => openKeyEditor()}>
                <Plus className="h-3 w-3 mr-1" />
                Add Key
              </Button>
              <Button size="sm" variant="outline" onClick={importDefaultKeys}>
                <Shield className="h-3 w-3 mr-1" />
                Import Defaults
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={importActiveDumpKeys}
                disabled={!extractDumpKeys(activeDump).length}
              >
                <KeyRound className="h-3 w-3 mr-1" />
                Import Dump Keys
              </Button>
            </div>

            {(["public", "private", "history"] as StoredKeyKind[]).map((kind) => {
              const entries = groupedKeys[kind];
              const label = kind.charAt(0).toUpperCase() + kind.slice(1);

              return (
                <div key={kind} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{label}</h3>
                    <Badge variant="outline">{entries.length}</Badge>
                  </div>

                  {entries.length === 0 ? (
                    <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                      No {kind} keys yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {entries.map((key) => (
                        <div key={key.id} className="rounded-xl border bg-card/40 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-semibold">{key.label}</h4>
                                <Badge
                                  variant={
                                    key.kind === "public"
                                      ? "default"
                                      : key.kind === "private"
                                        ? "secondary"
                                        : "warning"
                                  }
                                >
                                  {label}
                                </Badge>
                              </div>
                              <div className="mt-2 text-sm font-mono text-foreground">
                                {key.value}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                {key.uidFilter ? (
                                  <span>UID {key.uidFilter}</span>
                                ) : (
                                  <span>All cards</span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {relativeTime(key.updatedAt)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => copyText(key.value)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => openKeyEditor(key)}
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                                onClick={() =>
                                  setKeys((prev) => prev.filter((entry) => entry.id !== key.id))
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="dumps" className="m-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={dumpSearch}
                  onChange={(e) => setDumpSearch(e.target.value)}
                  placeholder="Search dumps, UID, notes..."
                  className="pl-9"
                />
              </div>
              <Badge variant="outline">Uses the in-browser dump cache</Badge>
            </div>

            <div className="space-y-3">
              {filteredDumps.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  No cached dumps yet. Import a JSON dump or run a dump command first.
                </div>
              ) : (
                filteredDumps.map((dump) => {
                  const meta = dumpMetaMap.get(dump.id);
                  const isActive = activeDump?.id === dump.id;

                  return (
                    <div
                      key={dump.id}
                      className={cn(
                        "rounded-xl border p-4",
                        isActive ? "border-primary/50 bg-primary/5" : "bg-card/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold">{dump.name}</h3>
                            {isActive ? <Badge variant="success">Active</Badge> : null}
                            {meta?.favorite ? <Badge variant="warning">Favorite</Badge> : null}
                            {dump.data.Card?.UID ? (
                              <Badge variant="outline">{dump.data.Card.UID}</Badge>
                            ) : null}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {relativeTime(dump.cachedAt)}
                            </span>
                            {dump.data.Card?.SAK ? <span>SAK {dump.data.Card.SAK}</span> : null}
                            {dump.data.Card?.ATQA ? <span>ATQA {dump.data.Card.ATQA}</span> : null}
                          </div>
                          <NotesPreview text={meta?.notes || ""} />
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => onDumpLoad?.(dump.data, dump.name)}
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => exportDump(dump)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                              openCardEditor({
                                name: dump.name,
                                uid: getDumpUid(dump),
                                type: dump.data.FileType || "Dump",
                                sak: sanitizeHex(dump.data.Card?.SAK || "", 2),
                                atqa: sanitizeHex(dump.data.Card?.ATQA || "", 4),
                                favorite: false,
                                notes: "",
                                sourceDumpId: dump.id,
                              })
                            }
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => openDumpEditor(dump)}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                            onClick={() => onDumpDelete?.(dump.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={Boolean(cardDraft)} onOpenChange={(open) => !open && setCardDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Card</DialogTitle>
            <DialogDescription>
              Store card identity and notes in the browser library.
            </DialogDescription>
          </DialogHeader>

          {cardDraft ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Name</label>
                <Input
                  value={cardDraft.name}
                  onChange={(e) =>
                    setCardDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                  }
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">UID</label>
                  <Input
                    value={cardDraft.uid}
                    onChange={(e) =>
                      setCardDraft((prev) =>
                        prev ? { ...prev, uid: sanitizeHex(e.target.value, 20) } : prev,
                      )
                    }
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Type</label>
                  <Input
                    value={cardDraft.type}
                    onChange={(e) =>
                      setCardDraft((prev) => (prev ? { ...prev, type: e.target.value } : prev))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">SAK</label>
                  <Input
                    value={cardDraft.sak}
                    onChange={(e) =>
                      setCardDraft((prev) =>
                        prev ? { ...prev, sak: sanitizeHex(e.target.value, 2) } : prev,
                      )
                    }
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">ATQA</label>
                  <Input
                    value={cardDraft.atqa}
                    onChange={(e) =>
                      setCardDraft((prev) =>
                        prev ? { ...prev, atqa: sanitizeHex(e.target.value, 4) } : prev,
                      )
                    }
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Notes</label>
                <textarea
                  value={cardDraft.notes}
                  onChange={(e) =>
                    setCardDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                  }
                  className="min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="What this card is, where it came from, recovery notes..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={cardDraft.favorite}
                  onChange={(e) =>
                    setCardDraft((prev) => (prev ? { ...prev, favorite: e.target.checked } : prev))
                  }
                />
                Favorite
              </label>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCardDraft(null)}>
              Cancel
            </Button>
            <Button onClick={saveCardDraft}>Save Card</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(keyDraft)} onOpenChange={(open) => !open && setKeyDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Key</DialogTitle>
            <DialogDescription>
              Keys are stored locally in the browser and can be grouped as public, private, or
              history.
            </DialogDescription>
          </DialogHeader>

          {keyDraft ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Label</label>
                <Input
                  value={keyDraft.label}
                  onChange={(e) =>
                    setKeyDraft((prev) => (prev ? { ...prev, label: e.target.value } : prev))
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Key Value (12 hex)</label>
                <Input
                  value={keyDraft.value}
                  onChange={(e) =>
                    setKeyDraft((prev) =>
                      prev ? { ...prev, value: sanitizeHex(e.target.value, 12) } : prev,
                    )
                  }
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">UID Filter</label>
                <Input
                  value={keyDraft.uidFilter}
                  onChange={(e) =>
                    setKeyDraft((prev) =>
                      prev ? { ...prev, uidFilter: sanitizeHex(e.target.value, 20) } : prev,
                    )
                  }
                  className="font-mono"
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Key Group</label>
                <div className="flex flex-wrap gap-2">
                  {(["public", "private", "history"] as StoredKeyKind[]).map((kind) => (
                    <Button
                      key={kind}
                      size="sm"
                      variant={keyDraft.kind === kind ? "default" : "outline"}
                      onClick={() => setKeyDraft((prev) => (prev ? { ...prev, kind } : prev))}
                    >
                      {kind}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyDraft(null)}>
              Cancel
            </Button>
            <Button onClick={saveKeyDraft}>Save Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(dumpDraft)} onOpenChange={(open) => !open && setDumpDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dump Notes</DialogTitle>
            <DialogDescription>
              Add local annotations and favorites to cached dumps without leaving the browser.
            </DialogDescription>
          </DialogHeader>

          {dumpDraft ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Display Name</label>
                <Input
                  value={dumpDraft.name}
                  onChange={(e) =>
                    setDumpDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Notes</label>
                <textarea
                  value={dumpDraft.notes}
                  onChange={(e) =>
                    setDumpDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                  }
                  className="min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Attack progress, card source, sector notes..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={dumpDraft.favorite}
                  onChange={(e) =>
                    setDumpDraft((prev) => (prev ? { ...prev, favorite: e.target.checked } : prev))
                  }
                />
                Favorite
              </label>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDumpDraft(null)}>
              Cancel
            </Button>
            <Button onClick={saveDumpDraft}>Save Notes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default LibraryPanel;
