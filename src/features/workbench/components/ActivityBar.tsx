import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  SquareStop,
  Terminal as TerminalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCommands } from "@/features/commands/context";
import { ConnectionChip } from "@/features/connection/ConnectionChip";
import type { ConnectionState } from "@/features/connection/model";
import type { VaultStats } from "@/features/vault/vault";

interface ActivityBarProps {
  connection: ConnectionState;
  vault: VaultStats;
  terminalOpen: boolean;
  /** Undefined while the terminal is already part of the layout (Session tab). */
  onToggleTerminal?: () => void;
}

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
 * The workbench's persistent footer. It is the reason a long-running command
 * doesn't pin you to the terminal: whatever tab you're on — reading a dump,
 * digging through saved keys — the running command, its elapsed time, its
 * latest output line and its stop button stay in view.
 */
export function ActivityBar({
  connection,
  vault,
  terminalOpen,
  onToggleTerminal,
}: ActivityBarProps) {
  const { activeJob, queuedJobs, activeLine, jobs, stopActive } = useCommands();
  const elapsed = useElapsed(activeJob?.startedAt);
  const finishedCount = jobs.filter(
    (job) => job.status === "done" || job.status === "stopped",
  ).length;

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

        <span
          className="hidden shrink-0 md:inline"
          title="Saved cards, keys, dumps and files across the vault"
        >
          {vault.cards} cards · {vault.keys} keys · {vault.dumps} dumps · {vault.files} files
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
