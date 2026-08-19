import { useEffect, useState } from "react";
import { CreditCard, FileText, HardDrive, KeyRound, Radio } from "lucide-react";
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
import type { IngestOutcome } from "@/features/vault/ingest/apply";
import type { IngestPlan } from "@/features/vault/ingest/types";
import type { ImportStage } from "./useCaptureImport";

interface ImportReviewDialogProps {
  stage: ImportStage;
  plan: IngestPlan | null;
  outcome: IngestOutcome | null;
  error: string;
  onConfirm: (virtualCardName: string | null) => void;
  onClose: () => void;
}

function sectorKeyCount(plan: IngestPlan): number {
  let count = 0;
  for (const entry of plan.dumps) {
    for (const sector of Object.values(entry.dump.SectorKeys ?? {})) {
      if (sector.KeyA) count += 1;
      if (sector.KeyB) count += 1;
    }
  }
  for (const entry of plan.looseKeys) {
    for (const sector of Object.values(entry.keys)) {
      if (sector.KeyA) count += 1;
      if (sector.KeyB) count += 1;
    }
  }
  return count;
}

/** Review what an import found before any of it is written to the vault. */
export function ImportReviewDialog({
  stage,
  plan,
  outcome,
  error,
  onConfirm,
  onClose,
}: ImportReviewDialogProps) {
  const [name, setName] = useState("");
  // Off by default: an import should not invent a grouping the user did not ask for.
  const [group, setGroup] = useState(false);

  // Seed the nickname from the folder name each time a new plan arrives.
  useEffect(() => {
    if (plan) setName(plan.suggestedName);
  }, [plan]);

  const open =
    stage === "reading" ||
    stage === "review" ||
    stage === "saving" ||
    stage === "done" ||
    stage === "error";
  const busy = stage === "reading" || stage === "saving";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {stage === "done"
              ? "Import complete"
              : stage === "error"
                ? "Import failed"
                : "Import capture"}
          </DialogTitle>
          <DialogDescription>
            {stage === "done"
              ? "Everything below is now in the browser vault."
              : stage === "error"
                ? error
                : "Files are sorted by what they actually contain, not by their extension."}
          </DialogDescription>
        </DialogHeader>

        {busy ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Reading files…</p>
        ) : null}

        {stage === "review" && plan ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Row icon={HardDrive} label="Card dumps" count={plan.dumps.length}>
                {plan.dumps.map((entry) => (
                  <li key={entry.name}>
                    {entry.name} — {entry.cardType.replace("classic-", "Classic ").toUpperCase()}
                    {entry.uid ? ` · UID ${entry.uid}` : ""} · {entry.blockCount} blocks
                  </li>
                ))}
              </Row>
              <Row icon={KeyRound} label="Recovered keys" count={sectorKeyCount(plan)} />
              <Row icon={Radio} label="LF credentials" count={plan.lfCards.length}>
                {plan.lfCards.map((entry) => (
                  <li key={entry.credential.name}>
                    {entry.credential.name}
                    {entry.carrier?.chip ? ` · ${entry.carrier.chip}` : ""}
                  </li>
                ))}
              </Row>
              <Row icon={FileText} label="Logs & notes kept as files" count={plan.assets.length} />
            </div>

            {plan.dualFrequency ? (
              <p className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
                Both an HF and an LF side were found — grouping them makes one dual-frequency card.
              </p>
            ) : null}

            {plan.skipped.length ? (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">
                  {plan.skipped.length} file(s) not imported
                </summary>
                <ul className="mt-1 space-y-0.5 pl-4">
                  {plan.skipped.map((entry) => (
                    <li key={entry.name}>
                      {entry.name} — {entry.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={group} onChange={(e) => setGroup(e.target.checked)} />
              Group as one virtual card
            </label>
            {group ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Card nickname"
              />
            ) : null}
          </div>
        ) : null}

        {stage === "done" && outcome ? (
          <ul className="space-y-1 text-sm">
            <li>{outcome.dumps} dump(s)</li>
            <li>{outcome.keys} new key(s)</li>
            <li>{outcome.lfCards} LF credential(s)</li>
            <li>{outcome.assets} file(s)</li>
            {outcome.virtualCardId ? <li>Grouped as one virtual card</li> : null}
          </ul>
        ) : null}

        <DialogFooter>
          {stage === "review" ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={() => onConfirm(group && name.trim() ? name.trim() : null)}
                disabled={Boolean(group && !name.trim())}
              >
                Import
              </Button>
            </>
          ) : (
            <Button onClick={onClose} disabled={busy}>
              {stage === "done" ? "Done" : "Close"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  icon: Icon,
  label,
  count,
  children,
}: {
  icon: typeof CreditCard;
  label: string;
  count: number;
  children?: React.ReactNode;
}) {
  if (!count) return null;
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{label}</span>
        <Badge variant="secondary" className="ml-auto">
          {count}
        </Badge>
      </div>
      {children ? (
        <ul className="mt-1 space-y-0.5 pl-6 text-xs text-muted-foreground">{children}</ul>
      ) : null}
    </div>
  );
}
