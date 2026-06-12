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
import type { CardDraft } from "../types";

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
          <DialogTitle>{draft?.id ? "Edit Card" : "Add Card"}</DialogTitle>
          <DialogDescription>
            Store card identity and notes in the browser library. No hardware needed — useful for
            cataloging cards you're analyzing from dumps.
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
                <label className="text-xs text-muted-foreground">UID (hex, required)</label>
                <Input
                  value={draft.uid}
                  onChange={(e) =>
                    onDraftChange((prev) =>
                      prev ? { ...prev, uid: sanitizeHex(e.target.value, 20) } : prev,
                    )
                  }
                  placeholder="04A23BC2"
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
          <Button onClick={onSave} disabled={!draft?.uid}>
            Save Card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
