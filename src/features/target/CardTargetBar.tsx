import { Copy, CreditCard, FileText, KeyRound, Layers, RefreshCw, Radio, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTarget } from "./context";

interface CardTargetBarProps {
  /** Re-scan the card in the reader (e.g. `hf 14a info`). */
  onRefresh?: () => void;
  /** Copy the active UID to the clipboard. */
  onCopyUid?: () => void;
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
 * A slim, always-visible strip describing the active card target. Unlike the
 * old sidebar (which was hidden the moment any panel opened), this stays mounted
 * across every tab so the card you're acting on is never out of sight.
 */
export function CardTargetBar({ onRefresh, onCopyUid, disabled = false }: CardTargetBarProps) {
  const { target, clearTarget } = useTarget();
  if (!target.hasCard) return null;

  const {
    identity,
    dump,
    classification,
    uid,
    savedKeyCount,
    relatedDumps,
    relatedAssets,
    source,
  } = target;
  const ProtocolIcon = classification.protocol === "LF" ? Radio : CreditCard;
  const typeLabel = identity?.type || FAMILY_LABEL[classification.family] || "Card";
  const displayUid = identity?.uid || dump?.data.Card?.UID || "—";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border bg-card/70 px-4 py-1.5 text-xs backdrop-blur">
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

      <div className="ml-auto flex items-center gap-1">
        {onRefresh ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-xs"
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
          className="h-6 w-6 px-0 text-muted-foreground"
          onClick={clearTarget}
          title="Clear active card"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
