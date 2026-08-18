import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PanelHeader } from "@/components/panels/shared/PanelHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTarget } from "@/features/target/context";
import type { CachedDump, PM3DumpJson } from "./CardMemoryMap";
import { DEFAULT_MIFARE_KEYS, sanitizeHex } from "@/lib/rfidUtils";
import { FolderOpen } from "lucide-react";
import { CardsTab } from "./library/CardsTab";
import { DumpsTab } from "./library/DumpsTab";
import { KeysTab } from "./library/KeysTab";
import { LfCardsTab } from "./library/LfCardsTab";
import { AuditTab } from "./library/AuditTab";
import { CardDialog, DumpDialog, KeyDialog } from "./library/LibraryDialogs";
import type {
  CardDraft,
  DumpDraft,
  KeyDraft,
  StoredCard,
  StoredDumpMeta,
  StoredKey,
} from "./library/types";
import {
  defaultCardName,
  exportStoredKeys,
  extractDumpKeys,
  getDumpUid,
  groupKeysBySource,
} from "./library/utils";
import {
  useVaultCards,
  useVaultDumps,
  useVaultKeys,
  useVaultLfCards,
  useVaultOperations,
  useVaultBackups,
} from "@/features/vault/hooks";
import {
  deleteCard,
  deleteKey,
  importKeyDrafts,
  saveCard,
  saveKey,
  setCardFavorite,
  setDumpMeta,
} from "@/features/vault/operations";

interface LibraryPanelProps {
  activeDump: CachedDump | null;
  onDumpLoad?: (dump: PM3DumpJson, name: string) => void;
  onDumpRename?: (id: string, newName: string) => void;
  onDumpDelete?: (id: string) => void;
  /** Navigate to another workspace (e.g. the Magic panel to write a card). */
  onOpenTab?: (tab: string) => void;
}

export function LibraryPanel({
  activeDump,
  onDumpLoad,
  onDumpRename,
  onDumpDelete,
  onOpenTab,
}: LibraryPanelProps) {
  const currentTag = useTarget().target.identity;

  // All library data is Dexie-backed live queries — they update automatically
  // when keys are imported from a dump, a card is saved, etc.
  const cards = useVaultCards();
  const keys = useVaultKeys();
  const cachedDumps = useVaultDumps();
  const lfCards = useVaultLfCards();
  const operations = useVaultOperations();
  const backups = useVaultBackups();

  const [cardSearch, setCardSearch] = useState("");
  const [keySearch, setKeySearch] = useState("");
  const [dumpSearch, setDumpSearch] = useState("");

  const [cardDraft, setCardDraft] = useState<CardDraft | null>(null);
  const [keyDraft, setKeyDraft] = useState<KeyDraft | null>(null);
  const [dumpDraft, setDumpDraft] = useState<DumpDraft | null>(null);

  // Favorite/notes now live on the dump record itself; rebuild the map the
  // dumps tab expects from those fields.
  const dumpMetaMap = useMemo(
    () =>
      new Map<string, StoredDumpMeta>(
        cachedDumps.map((dump) => [
          dump.id,
          {
            dumpId: dump.id,
            favorite: dump.favorite,
            notes: dump.notes,
            updatedAt: dump.updatedAt,
          },
        ]),
      ),
    [cachedDumps],
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

  const keyGroups = useMemo(
    () => groupKeysBySource(filteredKeys, dumpMap, cards),
    [filteredKeys, dumpMap, cards],
  );

  const filteredDumps = useMemo(() => {
    const filter = dumpSearch.trim().toUpperCase();
    const next = [...cachedDumps].sort((a, b) => {
      if (a.favorite !== b.favorite) return Number(b.favorite) - Number(a.favorite);
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
    if (!currentTag?.uid || currentTag.protocol === "LF") return null;

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
    void importKeyDrafts(
      DEFAULT_MIFARE_KEYS.map((value) => ({
        label: `Common ${value}`,
        value,
        kind: "public" as const,
        uidFilter: "",
      })),
      keys,
    );
  };

  const importActiveDumpKeys = () => {
    if (!activeDumpKeyDrafts.length) return;
    void importKeyDrafts(activeDumpKeyDrafts, keys);
  };

  const openDumpById = (dumpId: string) => {
    const dump = dumpMap.get(dumpId);
    if (dump) onDumpLoad?.(dump.data, dump.name);
  };

  // "Write card" from a key group: make the group's card the active target (via
  // its source dump when we still have it) and hand off to the Magic/clone panel
  // where the recovered keys and UID are already in scope.
  const writeCardFromGroup = (group: (typeof keyGroups)[number]) => {
    if (group.sourceDumpId) openDumpById(group.sourceDumpId);
    onOpenTab?.("magic");
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

    void saveCard(cardDraft, cards);
    setCardDraft(null);
  };

  const saveKeyDraft = () => {
    if (!keyDraft) return;
    if (sanitizeHex(keyDraft.value, 12).length !== 12) return;

    void saveKey(keyDraft, keys);
    setKeyDraft(null);
  };

  const saveDumpDraft = () => {
    if (!dumpDraft) return;

    void setDumpMeta(dumpDraft.id, { favorite: dumpDraft.favorite, notes: dumpDraft.notes });

    const dump = dumpMap.get(dumpDraft.id);
    if (dump && dumpDraft.name.trim() && dumpDraft.name.trim() !== dump.name) {
      onDumpRename?.(dumpDraft.id, dumpDraft.name.trim());
    }

    setDumpDraft(null);
  };

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <PanelHeader icon={FolderOpen} title="Browser Library" tag="Local Only" />

      <CardContent className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="cards" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="cards">Cards</TabsTrigger>
              <TabsTrigger value="keys">Keys</TabsTrigger>
              <TabsTrigger value="dumps">Dumps</TabsTrigger>
              <TabsTrigger value="lf">LF</TabsTrigger>
              <TabsTrigger value="audit">Audit & backups</TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{cards.length} cards</Badge>
              <Badge variant="secondary">{keys.length} keys</Badge>
              <Badge variant="secondary">{cachedDumps.length} dumps</Badge>
              <Badge variant="secondary">{lfCards.length} LF</Badge>
              <Badge variant="secondary">{operations.length} reports</Badge>
              <Badge variant="secondary">{backups.length} backups</Badge>
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
              onDeleteCard={(cardId) => void deleteCard(cardId)}
              onDumpLoad={onDumpLoad}
              onOpenCardEditor={openCardEditor}
              onToggleFavorite={(cardId) => {
                const card = cards.find((entry) => entry.id === cardId);
                if (card) void setCardFavorite(cardId, !card.favorite);
              }}
            />
          </TabsContent>

          <TabsContent value="keys" className="m-0">
            <KeysTab
              keySearch={keySearch}
              keyGroups={keyGroups}
              totalKeys={keys.length}
              canImportActiveDumpKeys={activeDumpKeyDrafts.length > 0}
              onKeySearchChange={setKeySearch}
              onOpenKeyEditor={openKeyEditor}
              onDeleteKey={(keyId) => void deleteKey(keyId)}
              onImportDefaultKeys={importDefaultKeys}
              onImportActiveDumpKeys={importActiveDumpKeys}
              onExportKeys={() => exportStoredKeys(filteredKeys)}
              onOpenDump={openDumpById}
              onWriteCard={writeCardFromGroup}
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

          <TabsContent value="lf" className="m-0">
            <LfCardsTab />
          </TabsContent>

          <TabsContent value="audit" className="m-0">
            <AuditTab />
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
