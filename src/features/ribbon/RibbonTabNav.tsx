import { Fragment, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollRail } from "@/components/ui/scroll-rail";
import { RIBBON_CONTROL } from "./primitives";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, LayoutGrid, RefreshCw, SquareStop } from "lucide-react";
import { ConnectionChip } from "@/features/connection/ConnectionChip";
import type { ConnectionState } from "@/features/connection/model";
import {
  getIcon,
  getWorkspace,
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
 *
 * Fourteen workspaces never fit a laptop, let alone a phone, so both controls
 * degrade the same way: a scrolling rail with honest edge affordances while
 * there is room for one, and the same grouped menu — reachable at every width
 * via the button at the rail's end — once there is not.
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
  const listRef = useRef<HTMLDivElement>(null);

  // A scrolled-away tab is the same as a missing one, so pull the active tab
  // back into view whenever it changes or the rail is resized under it.
  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeWorkspace]);

  /** Roving focus across the tablist; selection stays on Enter/Space. */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const tabs = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []);
    if (tabs.length === 0) return;
    const current = tabs.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : current < 0
            ? 0
            : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[next]?.focus();
    tabs[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5">
      {/* Phone-width: the rail's contents, folded into its own menu. */}
      <WorkspaceMenu
        activeWorkspace={activeWorkspace}
        onWorkspaceChange={onWorkspaceChange}
        variant="labelled"
        className="md:hidden"
      />

      <ScrollRail
        className="hidden md:block"
        contentClassName="items-end"
        role="tablist"
        aria-label="Workspace"
        onKeyDown={handleKeyDown}
      >
        <div ref={listRef} className="flex min-w-max items-stretch">
          {groupWorkspaces().map((group, index) => (
            <div key={group.name} className="flex items-stretch">
              {index > 0 ? (
                <Separator orientation="vertical" className="mx-1 h-8 shrink-0 self-center" />
              ) : null}
              <div className="flex flex-col gap-0.5">
                <span className="px-2.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/55">
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
      </ScrollRail>

      {/* Same menu, always present: the rail can be scrolled, this cannot be
          missed, so no workspace is ever more than two clicks away. */}
      <WorkspaceMenu
        activeWorkspace={activeWorkspace}
        onWorkspaceChange={onWorkspaceChange}
        variant="icon"
        className="hidden md:inline-flex"
      />

      <Separator orientation="vertical" className="mx-0.5 h-5 shrink-0" />

      <div className="flex shrink-0 items-center gap-1">
        <ConnectionChip connection={connection} className="hidden sm:inline-flex" />
        <ConnectionChip connection={connection} compact className="sm:hidden" />
        <TooltipProvider delayDuration={300}>
          {onStopOperation ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isBusy ? "destructive" : "ghost"}
                  size="icon"
                  onClick={onStopOperation}
                  disabled={!commandsEnabled}
                  className={cn("h-7 w-7", !isBusy && "text-muted-foreground")}
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
                  className="h-7 w-7 text-orange-600 hover:bg-orange-500/10 dark:text-orange-400"
                  aria-label="Force reset"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Force reset (will disconnect)</TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <ThemeToggle theme={theme} onThemeChange={onThemeChange} className="h-7 w-7" />
            </TooltipTrigger>
            <TooltipContent>Theme: {theme}. Click to cycle.</TooltipContent>
          </Tooltip>
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
      tabIndex={active ? 0 : -1}
      title={workspace.hint}
      onClick={onSelect}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-none bg-transparent px-2.5 text-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        active
          ? "text-foreground shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {getIcon(workspace.icon, "h-3 w-3 shrink-0")}
      {workspace.label}
    </button>
  );
}

/**
 * Every workspace, grouped, in one menu. Doubles as the whole switcher on
 * phone-width viewports, where a rail of fourteen tabs is not navigation.
 */
function WorkspaceMenu({
  activeWorkspace,
  onWorkspaceChange,
  variant,
  className,
}: {
  activeWorkspace: string;
  onWorkspaceChange: (value: string) => void;
  variant: "labelled" | "icon";
  className?: string;
}) {
  const active = getWorkspace(activeWorkspace);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "labelled" ? (
          <button
            type="button"
            aria-label={`Workspace: ${active.label}. Change workspace`}
            className={cn(
              "flex min-w-0 flex-1 select-none items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent",
              className,
            )}
          >
            {getIcon(active.icon, "h-4 w-4 shrink-0 text-primary")}
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/55">
                {active.group}
              </span>
              <span className="truncate text-xs text-foreground">{active.label}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            aria-label="All workspaces"
            title="All workspaces"
            className={cn("h-7 w-7 shrink-0 text-muted-foreground", className)}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[70vh] overflow-y-auto">
        {groupWorkspaces().map((group, index) => (
          <Fragment key={group.name}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel>{group.name}</DropdownMenuLabel>
            {group.workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.value}
                onSelect={() => onWorkspaceChange(workspace.value)}
                className={workspace.value === activeWorkspace ? "text-foreground" : undefined}
              >
                {getIcon(workspace.icon, "h-3.5 w-3.5 shrink-0 text-muted-foreground")}
                <span className="flex-1 whitespace-nowrap">{workspace.label}</span>
                {workspace.value === activeWorkspace ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
    <div className="flex shrink-0 items-center self-stretch border-r border-border/60 pr-2 sm:items-stretch">
      {/* Phone-width: the chips would eat the whole ribbon, so fold them in. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Commands: ${RIBBON_STRIP_LABELS[activeStrip]}. Change command strip`}
            className="flex select-none items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent sm:hidden"
          >
            <span className="flex flex-col leading-tight">
              <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/55">
                Commands
              </span>
              <span className="whitespace-nowrap text-xs text-foreground">
                {RIBBON_STRIP_LABELS[activeStrip]}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Commands</DropdownMenuLabel>
          {strips.map((strip) => (
            <DropdownMenuItem key={strip} onSelect={() => onStripChange(strip)}>
              <span className="flex-1 whitespace-nowrap">{RIBBON_STRIP_LABELS[strip]}</span>
              {strip === activeStrip ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Same caption and same row height as a command group, but flat and
          iconless: these pick which commands you see, they are not commands. */}
      <div className="hidden flex-col gap-1 sm:flex">
        <span className="px-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/55">
          Commands
        </span>
        <div className="flex items-center gap-0.5">
          {strips.map((strip) => (
            <button
              key={strip}
              type="button"
              onClick={() => onStripChange(strip)}
              aria-pressed={strip === activeStrip}
              className={cn(
                RIBBON_CONTROL,
                "inline-flex items-center rounded-md transition-colors",
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
    </div>
  );
}

export default RibbonTabNav;
