import { useMemo, useState } from "react";
import { Clock, Copy, Radio, Search, Star, Trash2, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVaultLfCards } from "@/features/vault/hooks";
import { deleteLfCard, setLfCardMeta } from "@/features/vault/operations";
import { buildRegisteredLfClone, describeLfCredential } from "@/features/lf-tools/formats";
import { lfCardToForm } from "@/features/lf-tools/lfParse";
import type { LfCardRecord } from "@/features/vault/db";
import { MemberOfBadges } from "./MemberOfBadges";
import { NotesPreview } from "./NotesPreview";
import { copyText, relativeTime } from "./utils";

interface LfCardsTabProps {
  /** Send the clone command straight to the terminal, when a runner is available. */
  onCommand?: (cmd: string) => void;
  /**
   * Open the guided LF write workflow (carrier check → clone → verify) for this
   * credential, instead of firing the raw clone command.
   */
  onGuidedWrite?: (card: LfCardRecord) => void;
}

function cloneCommandFor(card: LfCardRecord): string | null {
  return buildRegisteredLfClone(lfCardToForm(card));
}

function detailFor(card: LfCardRecord): string {
  return describeLfCredential(lfCardToForm(card));
}

/** Browse and reuse LF credentials captured from `lf search` / `lf hid reader`. */
export function LfCardsTab({ onCommand, onGuidedWrite }: LfCardsTabProps) {
  const lfCards = useVaultLfCards();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lfCards;
    return lfCards.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.raw ?? "").toLowerCase().includes(q) ||
        detailFor(c).toLowerCase().includes(q),
    );
  }, [lfCards, search]);

  return (
    <div className="space-y-4">
      <div className="relative min-w-[240px] flex-1">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search LF cards, format, ID, notes..."
          className="pl-9"
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            No LF cards yet. Run <code>lf search</code> or <code>lf hid reader</code> with a card on
            the LF antenna and it will be saved here automatically.
          </div>
        ) : (
          filtered.map((card) => {
            const cmd = cloneCommandFor(card);
            return (
              <div key={card.id} className="flex gap-3 rounded-xl border bg-card/40 p-4">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Radio className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{card.name}</h3>
                        {card.favorite ? <Badge variant="warning">Favorite</Badge> : null}
                        <Badge variant="outline" className="uppercase">
                          {card.tech}
                        </Badge>
                        {card.writable ? <Badge variant="success">writable</Badge> : null}
                        <MemberOfBadges kind="lfCard" refId={card.id} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono text-foreground">{detailFor(card)}</span>
                        {card.chip ? <span>{card.chip}</span> : null}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {relativeTime(card.updatedAt)}
                        </span>
                      </div>
                      <NotesPreview text={card.notes} />
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {onGuidedWrite ? (
                        <Button
                          size="sm"
                          className="h-8 gap-1 px-2"
                          onClick={() => onGuidedWrite(card)}
                          title="Step through a verified write: check the blank carrier, clone, then read back"
                        >
                          <Wand2 className="h-3.5 w-3.5" />
                          Write
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant={card.favorite ? "default" : "ghost"}
                        className="h-8 w-8 p-0"
                        onClick={() => void setLfCardMeta(card.id, { favorite: !card.favorite })}
                        aria-label="Toggle favorite"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                      {cmd ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => copyText(cmd)}
                          aria-label="Copy clone command"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                        onClick={() => void deleteLfCard(card.id)}
                        aria-label="Delete LF card"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {cmd ? (
                    <div className="mt-3 flex items-center gap-2">
                      <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                        {cmd}
                      </code>
                      {onCommand ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => onCommand(cmd)}
                          title="Send the raw clone command straight to the terminal"
                        >
                          Quick clone
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default LfCardsTab;
