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
import type { DumpDraft } from "../types";

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
          <DialogTitle>Rename dump &amp; notes</DialogTitle>
          <DialogDescription>
            Give this dump a memorable name and add local annotations or a favorite flag — all
            stored in the browser.
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
