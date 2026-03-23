import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CachedDump, PM3DumpJson } from "@/features/memory/types";
import { cn } from "@/lib/utils";
import { Check, Clock, Copy, CreditCard, Pencil, Trash2, X } from "lucide-react";

interface DumpCacheBrowserProps {
  cachedDumps: CachedDump[];
  activeDump?: CachedDump | null;
  onClose: () => void;
  onDumpLoad?: (dump: PM3DumpJson, name: string) => void;
  onDumpRename?: (id: string, newName: string) => void;
  onDumpDelete?: (id: string) => void;
}

export function DumpCacheBrowser({
  cachedDumps,
  activeDump,
  onClose,
  onDumpLoad,
  onDumpRename,
  onDumpDelete,
}: DumpCacheBrowserProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  return (
    <div className="space-y-2 rounded-lg border bg-secondary/20 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Saved Card Dumps</span>
        <Button size="sm" variant="ghost" onClick={onClose} className="h-5 w-5 p-0">
          <X className="h-3 w-3" />
        </Button>
      </div>

      {cachedDumps.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          No cached cards yet. Import a JSON dump to get started.
        </p>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {cachedDumps.map((dump) => (
            <div
              key={dump.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2 transition-colors",
                activeDump?.id === dump.id
                  ? "border-primary/30 bg-primary/10"
                  : "border-transparent bg-background hover:bg-secondary/50",
              )}
            >
              <CreditCard className="h-4 w-4 shrink-0 text-primary" />

              {renamingId === dump.id ? (
                <div className="flex flex-1 items-center gap-1">
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="h-6 flex-1 text-xs"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onDumpRename?.(dump.id, renameValue);
                        setRenamingId(null);
                      }
                      if (e.key === "Escape") {
                        setRenamingId(null);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onDumpRename?.(dump.id, renameValue);
                      setRenamingId(null);
                    }}
                    className="h-5 w-5 p-0"
                  >
                    <Check className="h-3 w-3 text-green-500" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRenamingId(null)}
                    className="h-5 w-5 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => onDumpLoad?.(dump.data, dump.name)}
                  >
                    <div className="truncate text-xs font-medium">{dump.name}</div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {dump.data.Card?.UID ? (
                        <span className="font-mono">{dump.data.Card.UID}</span>
                      ) : null}
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(dump.cachedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRenamingId(dump.id);
                        setRenameValue(dump.name);
                      }}
                      className="h-6 w-6 p-0"
                      title="Rename"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void navigator.clipboard.writeText(dump.data.Card?.UID || "")}
                      className="h-6 w-6 p-0"
                      title="Copy UID"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDumpDelete?.(dump.id)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
