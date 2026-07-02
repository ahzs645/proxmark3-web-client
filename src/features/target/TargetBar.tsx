import { useMemo } from "react";
import { Copy, CreditCard, FileText, KeyRound, Layers, RefreshCw, Radio, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTarget } from "./context";
import { getNextSteps } from "./nextSteps";

interface TargetBarProps {
  /** Run a pm3 command (for action steps and re-scan). */
  onCommand: (cmd: string) => void;
  /** Open a workspace tab (for navigation steps). */
  onOpenTab: (tab: string) => void;
  /** Re-scan the card in the reader (e.g. `hf 14a info`). */
  onRefresh?: () => void;
  /** Copy the active UID to the clipboard. */
  onCopyUid?: () => void;
  /** Disables command-backed controls when the client can't run commands yet. */
  disabled?: boolean;
}

const FAMILY_LABEL: Record<string, string> = {
  classic: "MIFARE Classic",
  ultralight: "Ultralight / NTAG",
  iclass: "iClass",
  desfire: "DESFire",
  lf: "Low Frequency",
  unknown: "Card",
};

/**
 * A single always-visible strip describing the active card target and the
 * recommended next steps. Consolidates what used to be two stacked bands (the
 * card-identity strip and the next-step spine) into one, so the workbench frame
 * stays lean while the card you're acting on — and where to go next — is never
 * out of sight.
 */
export function TargetBar({
  onCommand,
  onOpenTab,
  onRefresh,
  onCopyUid,
  disabled = false,
}: TargetBarProps) {
  const { target, clearTarget } = useTarget();
  const steps = useMemo(() => getNextSteps(target), [target]);

  const {
    identity,
    dump,
    classification,
    uid,
    savedKeyCount,
    relatedDumps,
    relatedAssets,
    source,
    hasCard,
  } = target;

  const ProtocolIcon = classification.protocol === "LF" ? Radio : CreditCard;
  const typeLabel = identity?.type || FAMILY_LABEL[classification.family] || "Card";
  const displayUid = identity?.uid || dump?.data.Card?.UID || "—";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border bg-card/70 px-4 py-1.5 text-xs backdrop-blur">
      {hasCard ? (
        <>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <ProtocolIcon className="h-3.5 w-3.5 text-primary" />
            {typeLabel}
          </span>

          {classification.size !== "unknown" ? (
            <Badge variant="outline" className="uppercase">
              {classification.size}
            </Badge>
          ) : null}

          {classification.protocol !== "unknown" ? (
            <Badge variant="secondary">{classification.protocol}</Badge>
          ) : null}

          <span className="flex items-center gap-1 font-mono text-muted-foreground">
            UID
            <button
              type="button"
              onClick={onCopyUid}
              disabled={!onCopyUid || displayUid === "—"}
              className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-foreground transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-60"
              title="Copy UID"
            >
              {displayUid}
              {displayUid !== "—" ? <Copy className="h-3 w-3 opacity-60" /> : null}
            </button>
          </span>

          <span
            className="flex items-center gap-1 text-muted-foreground"
            title={`${savedKeyCount} key${savedKeyCount === 1 ? "" : "s"} saved in the library for ${uid || "this card"}`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            {savedKeyCount}
          </span>

          {dump ? (
            <span
              className="flex items-center gap-1 text-muted-foreground"
              title={`Active dump: ${dump.name}`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="max-w-[16ch] truncate">{dump.name}</span>
              {relatedDumps.length > 1 ? <span>+{relatedDumps.length - 1}</span> : null}
            </span>
          ) : relatedDumps.length > 0 ? (
            <span
              className="flex items-center gap-1 text-muted-foreground"
              title={`${relatedDumps.length} cached dump${relatedDumps.length === 1 ? "" : "s"} for this card`}
            >
              <Layers className="h-3.5 w-3.5" />
              {relatedDumps.length}
            </span>
          ) : null}

          {relatedAssets.length > 0 ? (
            <span
              className="flex items-center gap-1 text-muted-foreground"
              title={`${relatedAssets.length} cached file${relatedAssets.length === 1 ? "" : "s"} for this card`}
            >
              <FileText className="h-3.5 w-3.5" />
              {relatedAssets.length}
            </span>
          ) : null}

          {source ? (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
              via {source}
            </span>
          ) : null}
        </>
      ) : (
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
          No card targeted
        </span>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {steps.map((step) => (
          <Button
            key={step.label}
            size="sm"
            variant={step.variant || "outline"}
            className="h-7 gap-1.5 text-xs"
            disabled={Boolean(step.command) && disabled}
            title={step.hint}
            onClick={() => {
              if (step.command) onCommand(step.command);
              else if (step.tab) onOpenTab(step.tab);
            }}
          >
            <step.icon className="h-3.5 w-3.5" />
            {step.label}
          </Button>
        ))}

        {hasCard ? (
          <>
            {onRefresh ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={onRefresh}
                disabled={disabled}
                title="Re-scan card"
              >
                <RefreshCw className="h-3 w-3" />
                Re-scan
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 px-0 text-muted-foreground"
              onClick={clearTarget}
              title="Clear active card"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
