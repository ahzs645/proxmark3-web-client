import type { KeyboardEvent, RefObject } from "react";
import { Send, Sparkles, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Terminal, type TerminalHandle } from "@/components/terminal/Terminal";

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
}

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
}: TerminalPaneProps) {
  return (
    <Card className="flex flex-1 flex-col overflow-hidden border-border/80 bg-card/80 backdrop-blur">
      <CardHeader className="space-y-3 border-b border-border/60 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span>Terminal</span>
            {canRunCommands ? (
              <Badge variant="success">Ready</Badge>
            ) : isLoading ? (
              <Badge variant="warning">Loading...</Badge>
            ) : (
              <Badge variant="secondary">Offline</Badge>
            )}
            {isDeviceConnected ? <Badge variant="outline">Device Connected</Badge> : null}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => onCommand("help")}>
              Help
            </Button>
            <Button size="sm" variant="outline" onClick={() => terminalRef.current?.clear()}>
              <Trash2 className="mr-1 h-3 w-3" />
              Clear
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex w-full items-center gap-2">
            <Input
              value={quickCommand}
              onChange={(e) => onQuickCommandChange(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) =>
                e.key === "Enter" && onRunQuickCommand()
              }
              placeholder="Send raw pm3 commands (hf mf autopwn --1k -f /pm3-cache/mfc_default_keys)"
              className="min-w-0 flex-1"
            />
            <Button size="sm" onClick={onRunQuickCommand} className="shrink-0">
              <Send className="mr-1 h-3 w-3" />
              Send
            </Button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <Button
              size="sm"
              variant="secondary"
              className="shrink-0"
              onClick={() => onQuickCommandChange("hf mf autopwn --1k")}
            >
              <Sparkles className="mr-1 h-3 w-3" />
              Autopwn
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0"
              onClick={() => onQuickCommandChange("hw tune")}
            >
              Tune
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0"
              onClick={() => onQuickCommandChange("hf iclass dump --ki 0")}
            >
              iCLASS
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0"
              onClick={() => onQuickCommandChange("trace list -t 14a -1")}
            >
              Trace
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
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
