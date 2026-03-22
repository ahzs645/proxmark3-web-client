import type { Dispatch, SetStateAction } from "react";
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
import { sanitizeHex } from "@/lib/rfidUtils";
import type { CardDraft, DumpDraft, KeyDraft, StoredKeyKind } from "./types";

interface CardDialogProps {
  draft: CardDraft | null;
  onDraftChange: Dispatch<SetStateAction<CardDraft | null>>;
  onSave: () => void;
  onClose: () => void;
}

export function CardDialog({ draft, onDraftChange, onSave, onClose }: CardDialogProps) {
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Card</DialogTitle>
          <DialogDescription>
            Store card identity and notes in the browser library.
          </DialogDescription>
        </DialogHeader>

        {draft ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input
                value={draft.name}
                onChange={(e) =>
                  onDraftChange((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">UID</label>
                <Input
                  value={draft.uid}
                  onChange={(e) =>
                    onDraftChange((prev) =>
                      prev ? { ...prev, uid: sanitizeHex(e.target.value, 20) } : prev,
                    )
                  }
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Type</label>
                <Input
                  value={draft.type}
                  onChange={(e) =>
                    onDraftChange((prev) => (prev ? { ...prev, type: e.target.value } : prev))
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">SAK</label>
                <Input
                  value={draft.sak}
                  onChange={(e) =>
                    onDraftChange((prev) =>
                      prev ? { ...prev, sak: sanitizeHex(e.target.value, 2) } : prev,
                    )
                  }
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">ATQA</label>
                <Input
                  value={draft.atqa}
                  onChange={(e) =>
                    onDraftChange((prev) =>
                      prev ? { ...prev, atqa: sanitizeHex(e.target.value, 4) } : prev,
                    )
                  }
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Notes</label>
              <textarea
                value={draft.notes}
                onChange={(e) =>
                  onDraftChange((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                }
                className="min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="What this card is, where it came from, recovery notes..."
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.favorite}
                onChange={(e) =>
                  onDraftChange((prev) => (prev ? { ...prev, favorite: e.target.checked } : prev))
                }
              />
              Favorite
            </label>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave}>Save Card</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface KeyDialogProps {
  draft: KeyDraft | null;
  onDraftChange: Dispatch<SetStateAction<KeyDraft | null>>;
  onSave: () => void;
  onClose: () => void;
}

export function KeyDialog({ draft, onDraftChange, onSave, onClose }: KeyDialogProps) {
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Key</DialogTitle>
          <DialogDescription>
            Keys are stored locally in the browser and can be grouped as public, private, or
            history.
          </DialogDescription>
        </DialogHeader>

        {draft ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Label</label>
              <Input
                value={draft.label}
                onChange={(e) =>
                  onDraftChange((prev) => (prev ? { ...prev, label: e.target.value } : prev))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Key Value (12 hex)</label>
              <Input
                value={draft.value}
                onChange={(e) =>
                  onDraftChange((prev) =>
                    prev ? { ...prev, value: sanitizeHex(e.target.value, 12) } : prev,
                  )
                }
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">UID Filter</label>
              <Input
                value={draft.uidFilter}
                onChange={(e) =>
                  onDraftChange((prev) =>
                    prev ? { ...prev, uidFilter: sanitizeHex(e.target.value, 20) } : prev,
                  )
                }
                className="font-mono"
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Key Group</label>
              <div className="flex flex-wrap gap-2">
                {(["public", "private", "history"] as StoredKeyKind[]).map((kind) => (
                  <Button
                    key={kind}
                    size="sm"
                    variant={draft.kind === kind ? "default" : "outline"}
                    onClick={() => onDraftChange((prev) => (prev ? { ...prev, kind } : prev))}
                  >
                    {kind}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave}>Save Key</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DumpDialogProps {
  draft: DumpDraft | null;
  onDraftChange: Dispatch<SetStateAction<DumpDraft | null>>;
  onSave: () => void;
  onClose: () => void;
}

export function DumpDialog({ draft, onDraftChange, onSave, onClose }: DumpDialogProps) {
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dump Notes</DialogTitle>
          <DialogDescription>
            Add local annotations and favorites to cached dumps without leaving the browser.
          </DialogDescription>
        </DialogHeader>

        {draft ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Display Name</label>
              <Input
                value={draft.name}
                onChange={(e) =>
                  onDraftChange((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Notes</label>
              <textarea
                value={draft.notes}
                onChange={(e) =>
                  onDraftChange((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                }
                className="min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Attack progress, card source, sector notes..."
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.favorite}
                onChange={(e) =>
                  onDraftChange((prev) => (prev ? { ...prev, favorite: e.target.checked } : prev))
                }
              />
              Favorite
            </label>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave}>Save Notes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
