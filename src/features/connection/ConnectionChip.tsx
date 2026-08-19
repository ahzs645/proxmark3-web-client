import { Check, CircleDashed, Loader2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ConnectionState, ConnectionTone, StageState } from "./model";

const TONE_DOT: Record<ConnectionTone, string> = {
  ok: "bg-green-500",
  warn: "bg-amber-500 status-pulse",
  error: "bg-red-500",
  idle: "bg-blue-500",
};

const TONE_TEXT: Record<ConnectionTone, string> = {
  ok: "text-green-600 dark:text-green-400",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
  idle: "text-muted-foreground",
};

function StageIcon({ state }: { state: StageState }) {
  if (state === "ok") return <Check className="h-3 w-3 text-green-500" />;
  if (state === "active") return <Loader2 className="h-3 w-3 animate-spin text-amber-500" />;
  if (state === "error") return <TriangleAlert className="h-3 w-3 text-red-500" />;
  return <CircleDashed className="h-3 w-3 text-muted-foreground/60" />;
}

interface ConnectionChipProps {
  connection: ConnectionState;
  /** Hide the text label, leaving just the status dot (for tight toolbars). */
  compact?: boolean;
  className?: string;
}

/**
 * The one place connection state is rendered. The tooltip spells out the
 * runtime → transport → client pipeline, so "why can't I run this?" has a
 * single, honest answer instead of four badges that disagree.
 */
export function ConnectionChip({ connection, compact = false, className }: ConnectionChipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center rounded-full border border-border/70 bg-background/60 py-0.5 text-[11px] font-medium",
              compact ? "h-5 w-5 justify-center" : "gap-1.5 px-2",
              TONE_TEXT[connection.tone],
              className,
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[connection.tone])}
              aria-hidden="true"
            />
            <span className={compact ? "sr-only" : undefined}>{connection.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs space-y-2 p-3">
          <p className="text-xs leading-snug">{connection.detail}</p>
          <ul className="space-y-1.5 border-t border-border pt-2">
            {connection.stages.map((stage, index) => (
              <li key={stage.key} className="flex items-center gap-2 text-[11px]">
                <span className="tabular-nums text-muted-foreground">{index + 1}</span>
                <StageIcon state={stage.state} />
                <span className="font-medium text-foreground">{stage.label}</span>
                <span className="text-muted-foreground">{stage.detail}</span>
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ConnectionChip;
