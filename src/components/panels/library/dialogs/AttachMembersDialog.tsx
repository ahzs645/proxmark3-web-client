import { useMemo, useState } from "react";
import { Check, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { VirtualCardMemberKind, VirtualCardMemberRecord } from "@/features/vault/db";
import {
  MEMBER_KIND_LABELS,
  MEMBER_KIND_TAGS,
  candidateSections,
  entryRefKeys,
  filterSections,
  linkedKeysFor,
  memberCandidates,
  memberRefKey,
  sectionRefKeys,
  type CandidateEntry,
  type CandidateSection,
  type MemberCandidate,
  type VirtualCardPools,
} from "@/features/vault/virtualCards";

interface AttachMembersDialogProps {
  /** Virtual card being edited, or null when the dialog is closed. */
  virtualCardId: string | null;
  virtualCardName: string;
  pools: VirtualCardPools;
  edges: VirtualCardMemberRecord[];
  onSave: (members: { kind: VirtualCardMemberKind; refId: string }[]) => void;
  onClose: () => void;
}

const KIND_ORDER: VirtualCardMemberKind[] = ["card", "lfCard", "dump", "key", "asset"];

const FILTERS: { value: VirtualCardMemberKind | "all"; label: string }[] = [
  { value: "all", label: "Everything" },
  ...KIND_ORDER.map((kind) => ({ value: kind, label: MEMBER_KIND_LABELS[kind].many })),
];

/**
 * Pick vault rows to attach to a virtual card. Rows already linked are shown
 * ticked, so the dialog doubles as a "what is on this card" review — untick to
 * detach, tick to attach, one save.
 *
 * Rows are nested by the relationships the vault already records: keys sit
 * under the dump they were recovered from, files under the folder they were
 * imported from. Ticking a dump or a folder takes everything beneath it, since
 * that is nearly always what belonging to a card means.
 */
export function AttachMembersDialog({
  virtualCardId,
  virtualCardName,
  pools,
  edges,
  onSave,
  onClose,
}: AttachMembersDialogProps) {
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<VirtualCardMemberKind | "all">("all");
  // Selection starts from what is already linked and is re-seeded whenever the
  // dialog is opened for a different card.
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [seededFor, setSeededFor] = useState<string | null>(null);
  // Nested keys start collapsed: a dump's key list is long and is usually taken
  // wholesale with the dump, so it should not bury the rest of the picker.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const linked = useMemo(
    () => (virtualCardId ? linkedKeysFor(virtualCardId, edges) : new Set<string>()),
    [virtualCardId, edges],
  );

  if (virtualCardId && seededFor !== virtualCardId) {
    setSeededFor(virtualCardId);
    setSelection(new Set(linked));
    setSearch("");
    setKindFilter("all");
    setExpanded(new Set());
  }

  const candidates = useMemo(() => memberCandidates(pools), [pools]);

  const sections = useMemo(() => {
    const needle = search.trim().toUpperCase();
    const matches = (row: MemberCandidate) =>
      !needle || `${row.label} ${row.detail}`.toUpperCase().includes(needle);

    // The "keys" filter deliberately flattens: nesting is the default reading,
    // but someone who asks for keys wants to see all of them, dump-owned or not.
    if (kindFilter === "key") {
      const rows = candidates.filter((row) => row.kind === "key" && matches(row));
      if (!rows.length) return [];
      const section: CandidateSection = {
        id: "keys:all",
        title: "All keys",
        entries: rows.map((candidate) => ({ candidate, children: [] })),
      };
      return [section];
    }

    const visible = candidates.filter((row) => kindFilter === "all" || row.kind === kindFilter);
    return filterSections(candidateSections(visible), matches);
  }, [candidates, kindFilter, search]);

  const toggleKeys = (keys: string[], on: boolean) => {
    setSelection((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  };

  const toggleOne = (candidate: MemberCandidate) => {
    const key = memberRefKey(candidate.kind, candidate.refId);
    toggleKeys([key], !selection.has(key));
  };

  /** A row takes everything nested under it. */
  const toggleEntry = (entry: CandidateEntry) => {
    const keys = entryRefKeys(entry);
    toggleKeys(keys, !keys.every((key) => selection.has(key)));
  };

  /** "Select all" on a section heading. */
  const toggleSection = (section: CandidateSection) => {
    const keys = sectionRefKeys(section);
    toggleKeys(keys, !keys.every((key) => selection.has(key)));
  };

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () => {
    onSave(
      [...selection].map((key) => {
        const [kind, ...rest] = key.split(":");
        return { kind: kind as VirtualCardMemberKind, refId: rest.join(":") };
      }),
    );
  };

  const changed = selection.size !== linked.size || [...selection].some((key) => !linked.has(key));

  return (
    <Dialog open={Boolean(virtualCardId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Attach to {virtualCardName || "virtual card"}</DialogTitle>
          <DialogDescription>
            Tick everything that belongs to this physical card. Keys sit under the dump they came
            from and files under the folder they were imported from — ticking one takes the rest.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, UID, key value…"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {FILTERS.map((filter) => (
              <Button
                key={filter.value}
                size="sm"
                variant={kindFilter === filter.value ? "default" : "outline"}
                className="h-7 capitalize"
                onClick={() => setKindFilter(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>

          <div className="max-h-[45vh] space-y-3 overflow-auto pr-1">
            {sections.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing in the vault matches. Capture a dump or run an LF read first.
              </p>
            ) : (
              sections.map((section) => {
                const keys = sectionRefKeys(section);
                const allOn = keys.length > 0 && keys.every((key) => selection.has(key));

                return (
                  <div key={section.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {section.title}
                      </p>
                      {keys.length > 1 ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1.5 text-[11px]"
                          onClick={() => toggleSection(section)}
                        >
                          {allOn ? "Clear" : "Select all"}
                        </Button>
                      ) : null}
                    </div>

                    {section.entries.map((entry) => {
                      const entryId = `${section.id}:${entry.candidate.refId}`;
                      const rowKey = memberRefKey(entry.candidate.kind, entry.candidate.refId);
                      const isOpen = expanded.has(entryId);

                      return (
                        <div key={rowKey} className="space-y-1">
                          <Row
                            candidate={entry.candidate}
                            checked={selection.has(rowKey)}
                            linked={linked.has(rowKey)}
                            showTags
                            onToggle={() => toggleEntry(entry)}
                            trailing={
                              entry.children.length ? (
                                <Badge variant="secondary">{entry.children.length} keys</Badge>
                              ) : null
                            }
                          />

                          {entry.children.length ? (
                            <button
                              type="button"
                              onClick={() => toggleExpanded(entryId)}
                              aria-expanded={isOpen}
                              className="flex items-center gap-1 pl-8 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              <ChevronRight
                                className={cn(
                                  "h-3 w-3 transition-transform",
                                  isOpen && "rotate-90",
                                )}
                              />
                              {isOpen ? "Hide" : "Show"} {entry.children.length} recovered key
                              {entry.children.length === 1 ? "" : "s"}
                            </button>
                          ) : entry.emptyHint ? (
                            <p className="pl-8 text-[11px] text-muted-foreground">
                              {entry.emptyHint}
                            </p>
                          ) : null}

                          {isOpen
                            ? entry.children.map((child) => {
                                const childKey = memberRefKey(child.kind, child.refId);
                                return (
                                  <Row
                                    key={childKey}
                                    candidate={child}
                                    checked={selection.has(childKey)}
                                    linked={linked.has(childKey)}
                                    indented
                                    onToggle={() => toggleOne(child)}
                                  />
                                );
                              })
                            : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <span className="mr-auto self-center text-xs text-muted-foreground">
            {selection.size} selected
          </span>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!changed}>
            Save members
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  candidate,
  checked,
  linked,
  indented,
  showTags,
  trailing,
  onToggle,
}: {
  candidate: MemberCandidate;
  checked: boolean;
  linked: boolean;
  indented?: boolean;
  /** Show the frequency/kind badges — top-level rows only; children inherit. */
  showTags?: boolean;
  trailing?: React.ReactNode;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className={cn(
        "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
        checked ? "border-primary/50 bg-primary/5" : "border-border/60",
        indented && "ml-6 w-[calc(100%-1.5rem)]",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          checked ? "border-primary bg-primary text-primary-foreground" : "",
        )}
      >
        {checked ? <Check className="h-3 w-3" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm">{candidate.label}</span>
          {showTags && candidate.protocol ? (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {candidate.protocol}
            </Badge>
          ) : null}
          {showTags ? (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {MEMBER_KIND_TAGS[candidate.kind]}
            </Badge>
          ) : null}
        </span>
        <span className="block truncate font-mono text-[11px] text-muted-foreground">
          {candidate.detail}
        </span>
      </span>
      {trailing}
      {linked ? <Badge variant="secondary">linked</Badge> : null}
    </button>
  );
}
