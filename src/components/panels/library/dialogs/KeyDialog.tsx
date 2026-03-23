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
import type { KeyDraft, StoredKeyKind } from "../types";

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
