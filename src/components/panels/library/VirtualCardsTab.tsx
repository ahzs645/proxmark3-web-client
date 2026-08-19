import { useState } from "react";
import {
  CreditCard,
  Edit3,
  FolderOpen,
  HardDrive,
  KeyRound,
  Link2,
  Plus,
  Radio,
  Search,
  Sparkles,
  Star,
  Trash2,
  Unlink,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { VirtualCardMemberKind, VirtualCardMemberRecord } from "@/features/vault/db";
import type { DumpRecord } from "@/features/vault/db";
import {
  MEMBER_KIND_TAGS,
  colorDotClass,
  formLabel,
  frequencyLabel,
  roleLabel,
  suggestedMembers,
  summarizeMembers,
  type ResolvedVirtualCard,
  type VirtualCardPools,
} from "@/features/vault/virtualCards";
import { ImportSourceButtons } from "@/features/import/ImportSourceButtons";
import { NotesPreview } from "./NotesPreview";
import { relativeTime } from "./utils";
import type { StoredCard } from "./types";

interface VirtualCardsTabProps {
  search: string;
  cards: ResolvedVirtualCard[];
  /** Every membership edge — needed to work out what is not yet linked. */
  edges: VirtualCardMemberRecord[];
  pools: VirtualCardPools;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onEdit: (resolved: ResolvedVirtualCard) => void;
  onDelete: (resolved: ResolvedVirtualCard) => void;
  onToggleFavorite: (resolved: ResolvedVirtualCard) => void;
  onAttach: (resolved: ResolvedVirtualCard) => void;
  onUnlink: (virtualCardId: string, kind: VirtualCardMemberKind, refId: string) => void;
  onLinkSuggested: (
    virtualCardId: string,
    members: { kind: VirtualCardMemberKind; refId: string }[],
  ) => void;
  onOpenDump?: (dumpId: string) => void;
  onWriteDump?: (dump: DumpRecord) => void;
  onWriteCard?: (card: StoredCard) => void;
}

const MEMBER_ICONS: Record<VirtualCardMemberKind, typeof CreditCard> = {
  card: CreditCard,
  lfCard: Radio,
  dump: HardDrive,
  key: KeyRound,
  asset: FolderOpen,
};

function frequencyVariant(frequency: ResolvedVirtualCard["frequency"]) {
  if (frequency === "dual") return "default" as const;
  if (frequency === "empty") return "outline" as const;
  return "secondary" as const;
}

/**
 * The organizing view over the vault: each row is one physical credential, with
 * the HF/LF rows, dumps, keys and files that belong to it folded underneath.
 */
export function VirtualCardsTab({
  search,
  cards,
  edges,
  pools,
  onSearchChange,
  onCreate,
  onEdit,
  onDelete,
  onToggleFavorite,
  onAttach,
  onUnlink,
  onLinkSuggested,
  onOpenDump,
  onWriteDump,
  onWriteCard,
}: VirtualCardsTabProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search cards, nicknames, tags, UIDs..."
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={onCreate}>
          <Plus className="h-3 w-3 mr-1" />
          New Virtual Card
        </Button>
        <ImportSourceButtons />
      </div>

      {cards.length === 0 ? (
        <div className="space-y-2 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          <p>No virtual cards yet.</p>
          <p className="mx-auto max-w-md text-xs">
            A virtual card stands for one real thing you carry — a dual-frequency badge, a fob, an
            implant. Create one and attach its HF card, LF credential, dumps and keys — or drop a
            capture folder anywhere in the window and one is assembled for you.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((resolved) => {
            const { record, members } = resolved;
            const isOpen = expanded.has(record.id);
            const suggestions = suggestedMembers(resolved, pools, edges);

            return (
              <div key={record.id} className="rounded-xl border bg-card/40 p-4">
                <div className="flex gap-3">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <span className={cn("h-3 w-3 rounded-full", colorDotClass(record.color))} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold">{record.name}</h3>
                          {record.favorite ? <Badge variant="warning">Favorite</Badge> : null}
                          <Badge variant="outline">{formLabel(record.form)}</Badge>
                          <Badge variant="outline">{roleLabel(record.role)}</Badge>
                          <Badge variant={frequencyVariant(resolved.frequency)}>
                            {frequencyLabel(resolved.frequency)}
                          </Badge>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {record.issuer ? <span>{record.issuer}</span> : null}
                          {resolved.uids.map((uid) => (
                            <span key={uid} className="font-mono text-foreground">
                              {uid}
                            </span>
                          ))}
                          <span>{relativeTime(record.updatedAt)}</span>
                        </div>

                        {resolved.technologies.length ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {resolved.technologies.join(" + ")}
                          </p>
                        ) : null}

                        {record.tags.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {record.tags.map((tag) => (
                              <Badge key={tag} variant="secondary">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : null}

                        <NotesPreview text={record.notes} />
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          variant={record.favorite ? "default" : "ghost"}
                          className="h-8 w-8 p-0"
                          onClick={() => onToggleFavorite(resolved)}
                          aria-label="Toggle favorite"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => onEdit(resolved)}
                          aria-label="Edit virtual card"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                          onClick={() => onDelete(resolved)}
                          aria-label="Delete virtual card"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {members.dump.length || members.card.length ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            if (members.dump.length === 1) onWriteDump?.(members.dump[0]);
                            else if (members.dump.length > 1) toggleExpanded(record.id);
                            else if (members.card[0]) onWriteCard?.(members.card[0]);
                          }}
                        >
                          <Upload className="mr-1 h-3 w-3" />
                          {members.dump.length > 1 ? "Choose HF source" : "Write HF"}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleExpanded(record.id)}
                        disabled={resolved.memberCount === 0}
                      >
                        {summarizeMembers(members)}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onAttach(resolved)}>
                        <Link2 className="h-3 w-3 mr-1" />
                        Attach
                      </Button>
                    </div>

                    {suggestions.length ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span className="text-muted-foreground">
                          {suggestions.length} more{" "}
                          {suggestions.length === 1 ? "row shares" : "rows share"} a UID with this
                          card
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 ml-auto"
                          onClick={() =>
                            onLinkSuggested(
                              record.id,
                              suggestions.map(({ kind, refId }) => ({ kind, refId })),
                            )
                          }
                        >
                          Link all
                        </Button>
                      </div>
                    ) : null}

                    {isOpen && resolved.memberCount > 0 ? (
                      <div className="mt-3 space-y-1 border-t pt-3">
                        {(
                          ["card", "lfCard", "dump", "key", "asset"] as VirtualCardMemberKind[]
                        ).flatMap((kind) =>
                          members[kind].map((row) => {
                            const Icon = MEMBER_ICONS[kind];
                            const label =
                              kind === "key"
                                ? `${(row as { label: string }).label} · ${(row as { value: string }).value}`
                                : (row as { name: string }).name;

                            return (
                              <div
                                key={`${kind}:${row.id}`}
                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50"
                              >
                                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate">{label}</span>
                                {kind === "asset" ? null : (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 px-1.5 py-0 text-[10px]"
                                  >
                                    {kind === "lfCard" ? "LF" : "HF"}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="shrink-0">
                                  {MEMBER_KIND_TAGS[kind]}
                                </Badge>
                                <div className="ml-auto flex shrink-0 items-center gap-1">
                                  {kind === "dump" && onWriteDump ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2"
                                      onClick={() => onWriteDump(row as DumpRecord)}
                                    >
                                      Write
                                    </Button>
                                  ) : null}
                                  {kind === "card" && onWriteCard ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2"
                                      onClick={() => onWriteCard(row as StoredCard)}
                                    >
                                      Write
                                    </Button>
                                  ) : null}
                                  {kind === "dump" && onOpenDump ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2"
                                      onClick={() => onOpenDump(row.id)}
                                    >
                                      Open
                                    </Button>
                                  ) : null}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => onUnlink(record.id, kind, row.id)}
                                    aria-label="Detach from virtual card"
                                  >
                                    <Unlink className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          }),
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default VirtualCardsTab;
