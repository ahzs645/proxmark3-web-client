import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTarget } from "@/features/target/context";
import type { CachedDump, PM3DumpJson } from "./CardMemoryMap";
import { DEFAULT_MIFARE_KEYS, sanitizeHex } from "@/lib/rfidUtils";
import { FolderOpen } from "lucide-react";
import { CardsTab } from "./library/CardsTab";
import { DumpsTab } from "./library/DumpsTab";
import { KeysTab } from "./library/KeysTab";
import { CardDialog, DumpDialog, KeyDialog } from "./library/LibraryDialogs";
import type {
  CardDraft,
  DumpDraft,
  GroupedKeys,
  KeyDraft,
  StoredCard,
  StoredDumpMeta,
  StoredKey,
} from "./library/types";
import {
  CARDS_STORAGE_KEY,
  DUMPS_STORAGE_KEY,
  KEYS_STORAGE_KEY,
  defaultCardName,
  extractDumpKeys,
  exportStoredKeys,
  getDumpUid,
  LIBRARY_KEYS_UPDATED_EVENT,
  loadStoredState,
  saveStoredState,
  upsertCardRecord,
  upsertKeyRecord,
} from "./library/utils";

interface LibraryPanelProps {
  activeDump: CachedDump | null;
  cachedDumps: CachedDump[];
  onDumpLoad?: (dump: PM3DumpJson, name: string) => void;
  onDumpRename?: (id: string, newName: string) => void;
  onDumpDelete?: (id: string) => void;
}

export function LibraryPanel({
  activeDump,
  cachedDumps,
  onDumpLoad,
  onDumpRename,
  onDumpDelete,
}: LibraryPanelProps) {
  const currentTag = useTarget().target.identity;
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
    saveStoredState(KEYS_STORAGE_KEY, keys);
  }, [keys]);

  useEffect(() => {
    localStorage.setItem(DUMPS_STORAGE_KEY, JSON.stringify(dumpMeta));
  }, [dumpMeta]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncKeysFromStorage = () => {
      setKeys(loadStoredState(KEYS_STORAGE_KEY, []));
    };

    window.addEventListener(LIBRARY_KEYS_UPDATED_EVENT, syncKeysFromStorage);
    return () => {
      window.removeEventListener(LIBRARY_KEYS_UPDATED_EVENT, syncKeysFromStorage);
    };
  }, []);

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

  const groupedKeys = useMemo<GroupedKeys>(
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

  const activeDumpKeyDrafts = useMemo(() => extractDumpKeys(activeDump), [activeDump]);

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
    if (!activeDumpKeyDrafts.length) return;
    setKeys((prev) =>
      activeDumpKeyDrafts.reduce((items, draft) => upsertKeyRecord(items, draft), prev),
    );
  };

  // Called with null/undefined to start a blank manual entry
  const openCardEditor = (card?: StoredCard | CardDraft | null) => {
    setCardDraft({
      id: card && "id" in card ? card.id : undefined,
      name: card?.name || "",
      uid: sanitizeHex(card?.uid || "", 20),
      type: card?.type || "",
      sak: sanitizeHex(card?.sak || "", 2),
      atqa: sanitizeHex(card?.atqa || "", 4),
      notes: card?.notes || "",
      favorite: card?.favorite || false,
      sourceDumpId: card?.sourceDumpId ?? null,
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

          <TabsContent value="cards" className="m-0">
            <CardsTab
              cardSearch={cardSearch}
              currentTagCardDraft={currentTagCardDraft}
              activeDumpCardDraft={activeDumpCardDraft}
              filteredCards={filteredCards}
              dumpMap={dumpMap}
              onCardSearchChange={setCardSearch}
              onDeleteCard={(cardId) =>
                setCards((prev) => prev.filter((entry) => entry.id !== cardId))
              }
              onDumpLoad={onDumpLoad}
              onOpenCardEditor={openCardEditor}
              onToggleFavorite={(cardId) =>
                setCards((prev) =>
                  prev.map((entry) =>
                    entry.id === cardId
                      ? { ...entry, favorite: !entry.favorite, updatedAt: Date.now() }
                      : entry,
                  ),
                )
              }
            />
          </TabsContent>

          <TabsContent value="keys" className="m-0">
            <KeysTab
              keySearch={keySearch}
              groupedKeys={groupedKeys}
              canImportActiveDumpKeys={activeDumpKeyDrafts.length > 0}
              onKeySearchChange={setKeySearch}
              onOpenKeyEditor={openKeyEditor}
              onDeleteKey={(keyId) => setKeys((prev) => prev.filter((entry) => entry.id !== keyId))}
              onImportDefaultKeys={importDefaultKeys}
              onImportActiveDumpKeys={importActiveDumpKeys}
              onExportKeys={() => exportStoredKeys(filteredKeys)}
            />
          </TabsContent>

          <TabsContent value="dumps" className="m-0">
            <DumpsTab
              dumpSearch={dumpSearch}
              filteredDumps={filteredDumps}
              dumpMetaMap={dumpMetaMap}
              activeDump={activeDump}
              onDumpSearchChange={setDumpSearch}
              onDumpLoad={onDumpLoad}
              onDeleteDump={onDumpDelete}
              onOpenDumpEditor={openDumpEditor}
              onCreateCardFromDump={(draft) => openCardEditor(draft)}
              onCreateDumpCardDraft={(dump) => ({
                name: dump.name,
                uid: getDumpUid(dump),
                type: dump.data.FileType || "Dump",
                sak: sanitizeHex(dump.data.Card?.SAK || "", 2),
                atqa: sanitizeHex(dump.data.Card?.ATQA || "", 4),
                favorite: false,
                notes: "",
                sourceDumpId: dump.id,
              })}
            />
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardDialog
        draft={cardDraft}
        onDraftChange={setCardDraft}
        onSave={saveCardDraft}
        onClose={() => setCardDraft(null)}
      />
      <KeyDialog
        draft={keyDraft}
        onDraftChange={setKeyDraft}
        onSave={saveKeyDraft}
        onClose={() => setKeyDraft(null)}
      />
      <DumpDialog
        draft={dumpDraft}
        onDraftChange={setDumpDraft}
        onSave={saveDumpDraft}
        onClose={() => setDumpDraft(null)}
      />
    </Card>
  );
}

export default LibraryPanel;
