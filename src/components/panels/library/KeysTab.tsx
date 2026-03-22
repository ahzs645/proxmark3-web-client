import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Copy, Edit3, KeyRound, Plus, Search, Shield, Trash2 } from "lucide-react";
import type { GroupedKeys, KeyDraft, StoredKey, StoredKeyKind } from "./types";
import { copyText, relativeTime } from "./utils";

interface KeysTabProps {
  keySearch: string;
  groupedKeys: GroupedKeys;
  canImportActiveDumpKeys: boolean;
  onKeySearchChange: (value: string) => void;
  onOpenKeyEditor: (key?: StoredKey | KeyDraft | null) => void;
  onDeleteKey: (keyId: string) => void;
  onImportDefaultKeys: () => void;
  onImportActiveDumpKeys: () => void;
}

export function KeysTab({
  keySearch,
  groupedKeys,
  canImportActiveDumpKeys,
  onKeySearchChange,
  onOpenKeyEditor,
  onDeleteKey,
  onImportDefaultKeys,
  onImportActiveDumpKeys,
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
                        <div className="mt-2 text-sm font-mono text-foreground">{key.value}</div>
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
                          onClick={() => onOpenKeyEditor(key)}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                          onClick={() => onDeleteKey(key.id)}
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
    </div>
  );
}
