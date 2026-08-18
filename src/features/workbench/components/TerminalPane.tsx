import type { KeyboardEvent, RefObject } from "react";
import { ChevronDown, Loader2, Send, Sparkles, SquareStop, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Terminal, type TerminalHandle } from "@/components/terminal/Terminal";
import { useCommands } from "@/features/commands/context";

interface TerminalPaneProps {
  terminalRef: RefObject<TerminalHandle | null>;
  canRunCommands: boolean;
  isLoading: boolean;
  isDeviceConnected: boolean;
  quickCommand: string;
  onQuickCommandChange: (value: string) => void;
  onRunQuickCommand: () => void;
  onCommand: (cmd: string) => void;
  onInput: (char: string) => void;
  /** When provided, shows a collapse button to hide the terminal dock. */
  onCollapse?: () => void;
}

const SHORTCUTS: Array<{ label: string; command: string }> = [
  { label: "Autopwn", command: "hf mf autopwn --1k" },
  { label: "Tune", command: "hw tune" },
  { label: "iCLASS", command: "hf iclass dump --ki 0" },
  { label: "Trace", command: "trace list -t 14a -1" },
];

export function TerminalPane({
  terminalRef,
  canRunCommands,
  isLoading,
  isDeviceConnected,
  quickCommand,
  onQuickCommandChange,
  onRunQuickCommand,
  onCommand,
  onInput,
  onCollapse,
}: TerminalPaneProps) {
  const { activeJob, queuedJobs, stopActive } = useCommands();
  // Docked = a main panel is open and the terminal sits below it. The activity
  // bar already reports connection + the running command from there, so the
  // dock header drops the big title/status band and keeps only the controls —
  // that is what stops the header from eating the xterm area on short screens.
  const docked = Boolean(onCollapse);

  const statusBadge = activeJob ? (
    <Badge variant="warning" className="gap-1">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span className="font-mono">{activeJob.command}</span>
      {activeJob.progress?.percent != null ? <span>{activeJob.progress.percent}%</span> : null}
      {queuedJobs.length > 0 ? <span>+{queuedJobs.length}</span> : null}
    </Badge>
  ) : canRunCommands ? (
    <Badge variant="success">Ready</Badge>
  ) : isLoading ? (
    <Badge variant="warning">Loading...</Badge>
  ) : (
    <Badge variant="secondary">Offline</Badge>
  );

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-1.5">
      {activeJob ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-destructive hover:bg-destructive/10"
          onClick={stopActive}
        >
          <SquareStop className="mr-1 h-3 w-3" />
          Stop
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" className="h-7" onClick={() => onCommand("help")}>
        Help
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        onClick={() => terminalRef.current?.clear()}
      >
        <Trash2 className="mr-1 h-3 w-3" />
        Clear
      </Button>
      {onCollapse ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7"
          onClick={onCollapse}
          aria-label="Hide terminal"
          title="Hide terminal"
        >
          <ChevronDown className="mr-1 h-3 w-3" />
          Hide
        </Button>
      ) : null}
    </div>
  );

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/80 bg-card/80 backdrop-blur">
      <CardHeader className="terminal-pane-header shrink-0 space-y-2 border-b border-border/60 p-3">
        {/* In dock mode the title row collapses into the input row to save
            vertical space; the Session view keeps the fuller title band. */}
        {docked ? null : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span>Terminal</span>
              {statusBadge}
              {isDeviceConnected ? <Badge variant="outline">Device Connected</Badge> : null}
            </CardTitle>
            {actionButtons}
          </div>
        )}

        <div className="flex w-full flex-wrap items-center gap-2">
          {docked ? statusBadge : null}
          <div className="flex min-w-[12rem] flex-1 items-center gap-2">
            <Input
              value={quickCommand}
              onChange={(e) => onQuickCommandChange(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) =>
                e.key === "Enter" && onRunQuickCommand()
              }
              placeholder="Send raw pm3 commands (hf mf autopwn --1k -f /pm3-cache/mfc_default_keys)"
              className="min-w-0 flex-1"
            />
            <Button
              size="sm"
              onClick={onRunQuickCommand}
              className="h-7 shrink-0"
              title={
                activeJob
                  ? "The client runs commands one at a time — this will queue behind the running one"
                  : undefined
              }
            >
              <Send className="mr-1 h-3 w-3" />
              {activeJob ? "Queue" : "Send"}
            </Button>
          </div>
          {docked ? actionButtons : null}
        </div>

        <div className="terminal-shortcuts flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {SHORTCUTS.map((shortcut, index) => (
            <Button
              key={shortcut.command}
              size="sm"
              variant={index === 0 ? "secondary" : "ghost"}
              className="h-7 shrink-0"
              onClick={() => onQuickCommandChange(shortcut.command)}
            >
              {index === 0 ? <Sparkles className="mr-1 h-3 w-3" /> : null}
              {shortcut.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="min-h-[7rem] flex-1 overflow-hidden p-0">
        <Terminal
          ref={terminalRef}
          onCommand={onCommand}
          onInput={onInput}
          rawMode={true}
          className="h-full"
        />
      </CardContent>
    </Card>
  );
}
