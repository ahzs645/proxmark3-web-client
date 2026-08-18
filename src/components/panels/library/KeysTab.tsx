import {
  Clock,
  Copy,
  Download,
  Edit3,
  FolderOpen,
  Globe,
  KeyRound,
  Layers,
  Plus,
  Search,
  Shield,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { KeyDraft, KeyGroup, StoredKey } from "./types";
import { copyText, relativeTime } from "./utils";

interface KeysTabProps {
  keySearch: string;
  keyGroups: KeyGroup[];
  totalKeys: number;
  canImportActiveDumpKeys: boolean;
  onKeySearchChange: (value: string) => void;
  onOpenKeyEditor: (key?: StoredKey | KeyDraft | null) => void;
  onDeleteKey: (keyId: string) => void;
  onImportDefaultKeys: () => void;
  onImportActiveDumpKeys: () => void;
  onExportKeys: () => void;
  /** Load a group's source dump as the active card. */
  onOpenDump: (dumpId: string) => void;
  /** Clone/write a card using this group's keys (opens the write panel). */
  onWriteCard: (group: KeyGroup) => void;
}

const KIND_BADGE: Record<
  KeyGroup["kind"],
  { label: string; variant: "success" | "secondary" | "outline" }
> = {
  session: { label: "Autopwn session", variant: "success" },
  card: { label: "Card", variant: "secondary" },
  common: { label: "Global", variant: "outline" },
};

function keyKindBadge(kind: StoredKey["kind"]) {
  if (kind === "public") return <Badge variant="default">public</Badge>;
  if (kind === "private") return <Badge variant="secondary">private</Badge>;
  return <Badge variant="warning">recovered</Badge>;
}

export function KeysTab({
  keySearch,
  keyGroups,
  totalKeys,
  canImportActiveDumpKeys,
  onKeySearchChange,
  onOpenKeyEditor,
  onDeleteKey,
  onImportDefaultKeys,
  onImportActiveDumpKeys,
  onExportKeys,
  onOpenDump,
  onWriteCard,
}: KeysTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keySearch}
            onChange={(e) => onKeySearchChange(e.target.value)}
            placeholder="Search keys, label, UID..."
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={() => onOpenKeyEditor()}>
          <Plus className="h-3 w-3 mr-1" />
          Add Key
        </Button>
        <Button size="sm" variant="outline" onClick={onImportDefaultKeys}>
          <Shield className="h-3 w-3 mr-1" />
          Import Defaults
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onImportActiveDumpKeys}
          disabled={!canImportActiveDumpKeys}
        >
          <KeyRound className="h-3 w-3 mr-1" />
          Import Dump Keys
        </Button>
        <Button size="sm" variant="outline" onClick={onExportKeys} disabled={totalKeys === 0}>
          <Download className="h-3 w-3 mr-1" />
          Export Keys
        </Button>
      </div>

      {keyGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No keys yet. Run an autopwn/dump to recover keys automatically, import the common
          dictionary, or add one by hand.
        </div>
      ) : (
        keyGroups.map((group) => {
          const kind = KIND_BADGE[group.kind];
          const GroupIcon = group.kind === "common" ? Globe : KeyRound;

          return (
            <section key={group.id} className="rounded-xl border bg-card/40">
              <header className="flex flex-wrap items-center gap-2 border-b border-border/60 p-3">
                <GroupIcon className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold">{group.title}</h3>
                    <Badge variant={kind.variant}>{kind.label}</Badge>
                    <Badge variant="outline">
                      {group.keys.length} key{group.keys.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  {group.subtitle ? (
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      {group.subtitle}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {group.sourceDumpId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1"
                      onClick={() => onOpenDump(group.sourceDumpId as string)}
                      title="Load this session's dump as the active card"
                    >
                      <FolderOpen className="h-3 w-3" />
                      Open dump
                    </Button>
                  ) : null}
                  {group.uid ? (
                    <Button
                      size="sm"
                      className="h-7 gap-1"
                      onClick={() => onWriteCard(group)}
                      title="Clone / write this card using these keys"
                    >
                      <Upload className="h-3 w-3" />
                      Write card
                    </Button>
                  ) : null}
                </div>
              </header>

              <ul className="divide-y divide-border/50">
                {group.keys.map((key) => (
                  <li key={key.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="font-mono text-sm text-foreground">{key.value}</code>
                        {keyKindBadge(key.kind)}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span className="truncate">{key.label || "Key"}</span>
                        {group.kind === "common" && key.uidFilter ? (
                          <span className="flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            {key.uidFilter}
                          </span>
                        ) : null}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {relativeTime(key.updatedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => copyText(key.value)}
                        title="Copy key"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => onOpenKeyEditor(key)}
                        title="Edit key"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                        onClick={() => onDeleteKey(key.id)}
                        aria-label="Delete key"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
