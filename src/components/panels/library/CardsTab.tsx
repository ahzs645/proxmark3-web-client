import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CachedDump, PM3DumpJson } from "../CardMemoryMap";
import {
  Clock,
  Copy,
  Edit3,
  FolderOpen,
  HardDrive,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { NotesPreview } from "./NotesPreview";
import type { CardDraft, StoredCard } from "./types";
import { copyText, relativeTime } from "./utils";

interface CardsTabProps {
  cardSearch: string;
  currentTagCardDraft: CardDraft | null;
  activeDumpCardDraft: CardDraft | null;
  filteredCards: StoredCard[];
  dumpMap: Map<string, CachedDump>;
  onCardSearchChange: (value: string) => void;
  onDeleteCard: (cardId: string) => void;
  onDumpLoad?: (dump: PM3DumpJson, name: string) => void;
  onOpenCardEditor: (card?: StoredCard | CardDraft | null) => void;
  onToggleFavorite: (cardId: string) => void;
}

export function CardsTab({
  cardSearch,
  currentTagCardDraft,
  activeDumpCardDraft,
  filteredCards,
  dumpMap,
  onCardSearchChange,
  onDeleteCard,
  onDumpLoad,
  onOpenCardEditor,
  onToggleFavorite,
}: CardsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={cardSearch}
            onChange={(e) => onCardSearchChange(e.target.value)}
            placeholder="Search cards, UID, notes..."
            className="pl-9"
          />
        </div>
        <Button
          size="sm"
          onClick={() => onOpenCardEditor(currentTagCardDraft)}
          disabled={!currentTagCardDraft}
        >
          <Plus className="h-3 w-3 mr-1" />
          Save Current Tag
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpenCardEditor(activeDumpCardDraft)}
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
                      onClick={() => onToggleFavorite(card.id)}
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
                      onClick={() => onOpenCardEditor(card)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                      onClick={() => onDeleteCard(card.id)}
                      aria-label="Delete card"
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
    </div>
  );
}
