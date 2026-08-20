import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  KeyRound,
  Layers,
  Loader2,
  Radio,
  RefreshCw,
  SquareStop,
  Terminal as TerminalIcon,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCommands } from "@/features/commands/context";
import { ConnectionChip } from "@/features/connection/ConnectionChip";
import type { ConnectionState } from "@/features/connection/model";
import type { VaultStats } from "@/features/vault/vault";
import { useTarget } from "@/features/target/context";
import { getNextSteps } from "@/features/target/nextSteps";

interface ActivityBarProps {
  connection: ConnectionState;
  vault: VaultStats;
  terminalOpen: boolean;
  /** Undefined while the terminal is already part of the layout (Session tab). */
  onToggleTerminal?: () => void;
  /** Run a pm3 command (for the card's next-step actions and re-scan). */
  onCommand: (cmd: string) => void;
  /** Open a workspace tab (for navigation steps). */
  onOpenTab: (tab: string) => void;
  /** Re-scan the card in the reader. */
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

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
}

/** Ticks once a second, but only while something is actually running. */
function useElapsed(startedAt: number | null | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  if (!startedAt) return null;
  return formatElapsed(now - startedAt);
}

/**
 * The workbench's persistent footer, and now the single home of the active-card
 * summary. It carries three things across every workspace: the connection and
 * running command (so a long job never pins you to the terminal), the card you
 * are operating on plus its recommended next steps (moved here from the old
 * always-on target strip), and the terminal-dock toggle.
 */
export function ActivityBar({
  connection,
  vault,
  terminalOpen,
  onToggleTerminal,
  onCommand,
  onOpenTab,
  onRefresh,
  onCopyUid,
  disabled = false,
}: ActivityBarProps) {
  const { activeJob, queuedJobs, activeLine, jobs, stopActive } = useCommands();
  const { target, clearTarget } = useTarget();
  const elapsed = useElapsed(activeJob?.startedAt);
  // Keep the footer a single, calm spine: it is a quick anchor, not a full
  // action bar (every workspace already hosts the complete set). Cap the
  // next-step buttons so a rich card can't wrap the footer into a wall.
  const allSteps = useMemo(() => getNextSteps(target), [target]);
  const steps = useMemo(
    () => allSteps.slice(0, target.hasCard ? 2 : allSteps.length),
    [allSteps, target.hasCard],
  );
  const finishedCount = jobs.filter(
    (job) => job.status === "done" || job.status === "stopped",
  ).length;

  const { identity, dump, classification, savedKeyCount, relatedDumps, hasCard } = target;
  const ProtocolIcon = classification.protocol === "LF" ? Radio : CreditCard;
  const typeLabel = identity?.type || FAMILY_LABEL[classification.family] || "Card";
  const displayUid = identity?.uid || dump?.data.Card?.UID || "—";
  const identifierLabel = classification.protocol === "LF" ? "ID" : "UID";

  return (
    <div className="border-t border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <ConnectionChip connection={connection} />
        <span className="hidden text-[11px] text-muted-foreground/80 sm:inline">
          {connection.transportLabel}
        </span>

        <div className="mx-1 hidden h-4 w-px shrink-0 bg-border sm:block" />

        {/* Running command — the multitasking anchor. */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {activeJob ? (
            <>
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
              <span className="shrink-0 font-mono text-[11px] text-foreground">
                {activeJob.command}
              </span>
              <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground/80">
                {elapsed}
              </span>
              {activeJob.progress?.phase ? (
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {activeJob.progress.phase}
                  {activeJob.progress.percent != null ? ` · ${activeJob.progress.percent}%` : ""}
                </Badge>
              ) : null}
              {queuedJobs.length > 0 ? (
                <span
                  className="shrink-0 rounded-full border border-border/70 px-1.5 text-[10px]"
                  title={queuedJobs.map((job) => job.command).join("\n")}
                >
                  +{queuedJobs.length} queued
                </span>
              ) : null}
              {activeLine ? (
                <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground/80">
                  {activeLine}
                </span>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 shrink-0 gap-1 px-2 text-[11px] text-destructive hover:bg-destructive/10"
                onClick={stopActive}
                title="Interrupt the running command (Ctrl+C)"
              >
                <SquareStop className="h-3 w-3" />
                Stop
              </Button>
            </>
          ) : (
            <span className="truncate text-[11px] text-muted-foreground/70">
              {finishedCount > 0
                ? `Idle · ${finishedCount} command${finishedCount === 1 ? "" : "s"} this session`
                : "Idle"}
            </span>
          )}
        </div>

        {/* Active card summary — the workbench's single source of "what am I
            acting on", moved out of the old always-on strip and into the footer. */}
        <div className="mx-1 hidden h-4 w-px shrink-0 bg-border lg:block" />
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {hasCard ? (
            <>
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <ProtocolIcon className="h-3.5 w-3.5 text-primary" />
                {typeLabel}
              </span>
              {classification.protocol !== "unknown" ? (
                <Badge variant="secondary" className="hidden sm:inline-flex">
                  {classification.protocol}
                </Badge>
              ) : null}
              <button
                type="button"
                onClick={onCopyUid}
                disabled={!onCopyUid || displayUid === "—"}
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-mono text-foreground transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-60"
                title={`Copy ${identifierLabel}`}
              >
                <span className="text-[10px] text-muted-foreground">{identifierLabel}</span>
                {displayUid}
                {displayUid !== "—" ? <Copy className="h-3 w-3 opacity-60" /> : null}
              </button>
              <span
                className="flex items-center gap-1"
                title={`${savedKeyCount} key${savedKeyCount === 1 ? "" : "s"} saved for this card`}
              >
                <KeyRound className="h-3.5 w-3.5" />
                {savedKeyCount}
              </span>
              {relatedDumps.length > 0 ? (
                <span
                  className="hidden items-center gap-1 md:flex"
                  title={`${relatedDumps.length} cached dump${relatedDumps.length === 1 ? "" : "s"} for this card`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  {relatedDumps.length}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
              No card targeted
            </span>
          )}

          {/* Recommended next steps for the card (or Scan HF/LF when none). */}
          {steps.map((step) => (
            <Button
              key={step.label}
              size="sm"
              variant={step.variant || "ghost"}
              className="h-6 gap-1 px-2 text-[11px]"
              disabled={Boolean(step.command) && disabled}
              title={step.hint}
              onClick={() => {
                if (step.command) onCommand(step.command);
                else if (step.tab) onOpenTab(step.tab);
              }}
            >
              <step.icon className="h-3 w-3" />
              {step.label}
            </Button>
          ))}

          {hasCard ? (
            <>
              {onRefresh ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-2 text-[11px]"
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
                className="h-6 w-6 shrink-0 px-0 text-muted-foreground"
                onClick={clearTarget}
                title="Clear active card"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : null}
        </div>

        <div className="mx-1 hidden h-4 w-px shrink-0 bg-border xl:block" />
        <span
          className="hidden shrink-0 xl:inline"
          title="Saved cards, keys, dumps and files across the vault"
        >
          {vault.cards} cards · {vault.keys} keys · {vault.dumps} dumps · {vault.files} files ·{" "}
          {vault.operations} ops
        </span>

        {onToggleTerminal ? (
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-6 shrink-0 gap-1 px-2 text-[11px]",
              activeJob && !terminalOpen && "text-primary",
            )}
            onClick={onToggleTerminal}
            title={terminalOpen ? "Hide the terminal dock" : "Show the terminal dock"}
          >
            <TerminalIcon className="h-3 w-3" />
            Terminal
            {terminalOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default ActivityBar;
