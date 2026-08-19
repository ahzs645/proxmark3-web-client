import { useMemo, useState } from "react";
import { Copy, Radio, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVaultLfCards } from "@/features/vault/hooks";
import { deleteLfCard } from "@/features/vault/operations";
import { buildRegisteredLfClone, describeLfCredential } from "@/features/lf-tools/formats";
import { lfCardToForm } from "@/features/lf-tools/lfParse";
import type { LfCardRecord } from "@/features/vault/db";
import { MemberOfBadges } from "./MemberOfBadges";

interface LfCardsTabProps {
  /** Send the clone command straight to the terminal, when a runner is available. */
  onCommand?: (cmd: string) => void;
}

function cloneCommandFor(card: LfCardRecord): string | null {
  return buildRegisteredLfClone(lfCardToForm(card));
}

function detailFor(card: LfCardRecord): string {
  return describeLfCredential(lfCardToForm(card));
}

/** Browse and reuse LF credentials captured from `lf search` / `lf hid reader`. */
export function LfCardsTab({ onCommand }: LfCardsTabProps) {
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
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search LF cards…"
        className="h-8 text-xs"
      />

      {filtered.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs text-muted-foreground">
          No LF cards yet. Run <code>lf search</code> or <code>lf hid reader</code> with a card on
          the LF antenna and it will be saved here automatically.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((card) => {
            const cmd = cloneCommandFor(card);
            return (
              <li key={card.id} className="rounded-md border border-border/60 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Radio className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{card.name}</span>
                      <Badge variant="secondary" className="uppercase">
                        {card.tech}
                      </Badge>
                      {card.writable && <Badge variant="success">writable</Badge>}
                      <MemberOfBadges kind="lfCard" refId={card.id} />
                    </div>
                    <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                      {detailFor(card)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void deleteLfCard(card.id)}
                    className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    aria-label="Delete LF card"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {cmd && (
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-[11px]">
                      {cmd}
                    </code>
                    {onCommand ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCommand(cmd)}
                        className="h-7"
                      >
                        Write
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void navigator.clipboard.writeText(cmd)}
                      className="h-7 w-7 p-0"
                      aria-label="Copy clone command"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default LfCardsTab;
