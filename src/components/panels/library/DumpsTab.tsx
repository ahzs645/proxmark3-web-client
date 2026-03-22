import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CachedDump, PM3DumpJson } from "../CardMemoryMap";
import { sanitizeHex } from "@/lib/rfidUtils";
import { cn } from "@/lib/utils";
import { Clock, CreditCard, Download, FileText, FolderOpen, Search, Trash2 } from "lucide-react";
import { NotesPreview } from "./NotesPreview";
import type { CardDraft, StoredDumpMeta } from "./types";
import { exportDump, relativeTime } from "./utils";

interface DumpsTabProps {
  dumpSearch: string;
  filteredDumps: CachedDump[];
  dumpMetaMap: Map<string, StoredDumpMeta>;
  activeDump: CachedDump | null;
  onDumpSearchChange: (value: string) => void;
  onDumpLoad?: (dump: PM3DumpJson, name: string) => void;
  onDeleteDump?: (id: string) => void;
  onOpenDumpEditor: (dump: CachedDump) => void;
  onCreateCardFromDump: (draft: CardDraft) => void;
  onCreateDumpCardDraft: (dump: CachedDump) => CardDraft;
}

export function DumpsTab({
  dumpSearch,
  filteredDumps,
  dumpMetaMap,
  activeDump,
  onDumpSearchChange,
  onDumpLoad,
  onDeleteDump,
  onOpenDumpEditor,
  onCreateCardFromDump,
  onCreateDumpCardDraft,
}: DumpsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={dumpSearch}
            onChange={(e) => onDumpSearchChange(e.target.value)}
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
                      {dump.data.Card?.SAK ? (
                        <span>SAK {sanitizeHex(dump.data.Card.SAK, 2)}</span>
                      ) : null}
                      {dump.data.Card?.ATQA ? (
                        <span>ATQA {sanitizeHex(dump.data.Card.ATQA, 4)}</span>
                      ) : null}
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
                      onClick={() => onCreateCardFromDump(onCreateDumpCardDraft(dump))}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => onOpenDumpEditor(dump)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                      onClick={() => onDeleteDump?.(dump.id)}
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
    </div>
  );
}
