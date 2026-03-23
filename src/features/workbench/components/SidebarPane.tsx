import { Activity } from "lucide-react";
import { TagInfoPanel, type TagInfo } from "@/components/panels/TagInfoPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SidebarPaneProps {
  tagInfo: TagInfo | null;
  canRunCommands: boolean;
  commandHistory: string[];
  isDeviceConnected: boolean;
  onCommand: (cmd: string) => void;
  onConnect: () => void;
  onCopyUid: () => void;
  onOpenMemory: () => void;
  onRefreshTag: () => void;
}

export function SidebarPane({
  tagInfo,
  canRunCommands,
  commandHistory,
  isDeviceConnected,
  onCommand,
  onConnect,
  onCopyUid,
  onOpenMemory,
  onRefreshTag,
}: SidebarPaneProps) {
  return (
    <div className="order-2 flex min-h-0 flex-col gap-4 md:order-1">
      <TagInfoPanel
        tagInfo={tagInfo}
        onRefresh={onRefreshTag}
        onCopyUid={onCopyUid}
        onCommand={onCommand}
        disabled={!canRunCommands}
      />

      <Card className="overflow-hidden border-border/80 bg-card/80 backdrop-blur md:flex-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Recent Commands
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          {commandHistory.length > 0 ? (
            <div className="space-y-1.5">
              {commandHistory
                .slice(-12)
                .reverse()
                .map((cmd, i) => (
                  <button
                    key={`${cmd}-${i}`}
                    type="button"
                    className="flex w-full items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-left text-xs font-mono text-muted-foreground transition-colors hover:border-border hover:bg-secondary/40 hover:text-foreground"
                    onClick={() => onCommand(cmd)}
                  >
                    <span className="truncate">{cmd}</span>
                    <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      rerun
                    </span>
                  </button>
                ))}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                No commands yet. Start with a quick action.
              </p>
              <div className="grid gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="justify-start"
                  onClick={() => {
                    if (isDeviceConnected) {
                      onCommand("hw version");
                    } else {
                      onConnect();
                    }
                  }}
                >
                  {isDeviceConnected ? "Reader Info" : "Connect Reader"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="justify-start"
                  onClick={() => onCommand("hf search")}
                  disabled={!canRunCommands}
                >
                  HF Search
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="justify-start"
                  onClick={onOpenMemory}
                >
                  Open Memory Workspace
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
