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
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { VirtualCardForm, VirtualCardRole } from "@/features/vault/db";
import {
  VIRTUAL_CARD_COLORS,
  VIRTUAL_CARD_FORMS,
  VIRTUAL_CARD_ROLES,
  parseTags,
} from "@/features/vault/virtualCards";

/** Editable shape of a virtual card, with tags kept as raw text while typing. */
export interface VirtualCardDraft {
  id?: string;
  name: string;
  form: VirtualCardForm;
  role: VirtualCardRole;
  issuer: string;
  color: string;
  tagsInput: string;
  notes: string;
  favorite: boolean;
}

interface VirtualCardDialogProps {
  draft: VirtualCardDraft | null;
  onDraftChange: Dispatch<SetStateAction<VirtualCardDraft | null>>;
  onSave: () => void;
  onClose: () => void;
}

const FORM_OPTIONS = VIRTUAL_CARD_FORMS.map((entry) => ({
  value: entry.value,
  label: entry.label,
}));

const ROLE_OPTIONS = VIRTUAL_CARD_ROLES.map((entry) => ({
  value: entry.value,
  label: entry.label,
}));

export function VirtualCardDialog({
  draft,
  onDraftChange,
  onSave,
  onClose,
}: VirtualCardDialogProps) {
  const roleHint = VIRTUAL_CARD_ROLES.find((entry) => entry.value === draft?.role)?.hint;
  const tags = draft ? parseTags(draft.tagsInput) : [];

  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{draft?.id ? "Edit virtual card" : "New virtual card"}</DialogTitle>
          <DialogDescription>
            A virtual card is one physical thing you carry. Name it, say what it is, then attach the
            HF card, LF credential, dumps and keys that belong to it — a dual-frequency badge
            becomes a single entry instead of scattered rows.
          </DialogDescription>
        </DialogHeader>

        {draft ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Nickname</label>
              <Input
                value={draft.name}
                onChange={(e) =>
                  onDraftChange((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                }
                placeholder="Office badge"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Form factor</label>
                <Select
                  value={draft.form}
                  options={FORM_OPTIONS}
                  className="w-full"
                  onValueChange={(value) =>
                    onDraftChange((prev) =>
                      prev ? { ...prev, form: value as VirtualCardForm } : prev,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Role</label>
                <Select
                  value={draft.role}
                  options={ROLE_OPTIONS}
                  className="w-full"
                  onValueChange={(value) =>
                    onDraftChange((prev) =>
                      prev ? { ...prev, role: value as VirtualCardRole } : prev,
                    )
                  }
                />
                {roleHint ? <p className="text-[11px] text-muted-foreground">{roleHint}</p> : null}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Issuer / where it is used</label>
              <Input
                value={draft.issuer}
                onChange={(e) =>
                  onDraftChange((prev) => (prev ? { ...prev, issuer: e.target.value } : prev))
                }
                placeholder="Campus, gym, hotel…"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Colour</label>
              <div className="flex flex-wrap gap-2">
                {VIRTUAL_CARD_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    aria-label={color.label}
                    aria-pressed={draft.color === color.value}
                    onClick={() =>
                      onDraftChange((prev) => (prev ? { ...prev, color: color.value } : prev))
                    }
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-colors",
                      color.dot,
                      draft.color === color.value ? "border-foreground" : "border-transparent",
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Tags (comma separated)</label>
              <Input
                value={draft.tagsInput}
                onChange={(e) =>
                  onDraftChange((prev) => (prev ? { ...prev, tagsInput: e.target.value } : prev))
                }
                placeholder="work, door access, spare"
              />
              {tags.length ? (
                <p className="text-[11px] text-muted-foreground">{tags.join(" · ")}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Notes</label>
              <textarea
                value={draft.notes}
                onChange={(e) =>
                  onDraftChange((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                }
                className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Where it came from, which reader it opens, what still needs recovering…"
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
          <Button onClick={onSave} disabled={!draft?.name.trim()}>
            {draft?.id ? "Save changes" : "Create card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
