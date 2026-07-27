import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { RefreshCw, SquareStop } from "lucide-react";
import { ConnectionChip } from "@/features/connection/ConnectionChip";
import type { ConnectionState } from "@/features/connection/model";
import {
  getIcon,
  groupWorkspaces,
  RIBBON_STRIP_LABELS,
  type RibbonStripId,
  type WorkspaceDefinition,
} from "./config";
import type { Theme } from "@/hooks/useTheme";

interface RibbonTabNavProps {
  connection: ConnectionState;
  activeWorkspace: string;
  onWorkspaceChange: (value: string) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onStopOperation?: () => void;
  onHardReset?: () => void;
  commandsEnabled: boolean;
  /** True while a command is executing, so Stop can be offered meaningfully. */
  isBusy: boolean;
}

/**
 * The workbench's navigation. Two controls with two different jobs:
 *
 *  - the workspace switcher (here) picks *where you are* — which panel fills
 *    the view — and nothing else;
 *  - the strip picker below it ({@link RibbonStripPicker}) picks *what you can
 *    run here*, and never moves you anywhere.
 *
 * Keeping those separate is what makes it safe to fire a command from the HF
 * strip while reading a dump in the Memory workspace.
 */
export function RibbonTabNav({
  connection,
  activeWorkspace,
  onWorkspaceChange,
  theme,
  onThemeChange,
  onStopOperation,
  onHardReset,
  commandsEnabled,
  isBusy,
}: RibbonTabNavProps) {
  return (
    <div className="relative flex items-center gap-2 px-2 py-1.5">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-card via-card/85 to-transparent" />
      <div className="flex min-w-0 flex-1 items-end gap-2 overflow-x-auto scrollbar-hide">
        <div className="flex min-w-max items-stretch" role="tablist" aria-label="Workspace">
          {groupWorkspaces().map((group, index) => (
            <div key={group.name} className="flex items-stretch">
              {index > 0 ? (
                <Separator orientation="vertical" className="mx-1.5 h-8 shrink-0 self-center" />
              ) : null}
              <div className="flex flex-col gap-0.5">
                <span className="px-3 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/55">
                  {group.name}
                </span>
                <div className="flex items-center gap-1">
                  {group.workspaces.map((workspace) => (
                    <WorkspaceTrigger
                      key={workspace.value}
                      workspace={workspace}
                      active={workspace.value === activeWorkspace}
                      onSelect={() => onWorkspaceChange(workspace.value)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <ConnectionChip connection={connection} />
        <Separator orientation="vertical" className="mx-0.5 h-4" />
        <TooltipProvider delayDuration={300}>
          {onStopOperation ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isBusy ? "destructive" : "ghost"}
                  size="icon"
                  onClick={onStopOperation}
                  disabled={!commandsEnabled}
                  className={cn("h-6 w-6", !isBusy && "text-muted-foreground")}
                  aria-label="Stop operation"
                >
                  <SquareStop className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isBusy ? "Stop the running command (Ctrl+C)" : "Nothing is running"}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {onHardReset ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onHardReset}
                  className="h-6 w-6 text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950"
                  aria-label="Force reset"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Force reset (will disconnect)</TooltipContent>
            </Tooltip>
          ) : null}
          <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
        </TooltipProvider>
      </div>
    </div>
  );
}

function WorkspaceTrigger({
  workspace,
  active,
  onSelect,
}: {
  workspace: WorkspaceDefinition;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      title={workspace.hint}
      onClick={onSelect}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-none bg-transparent px-3 py-1.5 text-xs transition-colors",
        active
          ? "text-foreground shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {getIcon(workspace.icon, "h-3 w-3")}
      {workspace.label}
    </button>
  );
}

interface RibbonStripPickerProps {
  strips: RibbonStripId[];
  activeStrip: RibbonStripId;
  onStripChange: (strip: RibbonStripId) => void;
}

/**
 * Chooses which command strip the ribbon shows. Rendered beside the strip
 * itself so it reads as "commands: [Connect] HF LF Data …" rather than as
 * another set of destinations.
 */
export function RibbonStripPicker({ strips, activeStrip, onStripChange }: RibbonStripPickerProps) {
  if (strips.length <= 1) return null;

  return (
    <div className="flex shrink-0 flex-col justify-center gap-1 self-stretch border-r border-border/60 pr-2">
      <span className="px-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/55">
        Commands
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {strips.map((strip) => (
          <button
            key={strip}
            type="button"
            onClick={() => onStripChange(strip)}
            aria-pressed={strip === activeStrip}
            className={cn(
              "rounded-md px-2 py-0.5 text-[11px] transition-colors",
              strip === activeStrip
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {RIBBON_STRIP_LABELS[strip]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default RibbonTabNav;
