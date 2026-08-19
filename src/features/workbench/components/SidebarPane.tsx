import { Activity, Check, Clock, Loader2, SquareStop } from "lucide-react";
import { TagInfoPanel } from "@/components/panels/TagInfoPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCommands } from "@/features/commands/context";
import type { CommandJob, CommandJobStatus } from "@/features/commands/types";
import { useTarget } from "@/features/target/context";
import type { LibraryKeyMode } from "@/features/keys/libraryKeyCommands";

const JOB_STATUS_LABEL: Record<CommandJobStatus, string> = {
  running: "running",
  queued: "queued",
  done: "done",
  stopped: "stopped",
};

function JobStatusIcon({ status }: { status: CommandJobStatus }) {
  if (status === "running")
    return <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />;
  if (status === "queued") return <Clock className="h-3 w-3 shrink-0 text-muted-foreground/70" />;
  if (status === "stopped") return <SquareStop className="h-3 w-3 shrink-0 text-destructive" />;
  return <Check className="h-3 w-3 shrink-0 text-green-500" />;
}

/** Wall-clock duration of a finished job, e.g. `12s`. */
function jobDuration(job: CommandJob): string | null {
  if (!job.startedAt || !job.endedAt) return null;
  const seconds = Math.max(0, Math.round((job.endedAt - job.startedAt) / 1000));
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m${seconds % 60}s` : `${seconds}s`;
}

interface SidebarPaneProps {
  canRunCommands: boolean;
  commandHistory: string[];
  isDeviceConnected: boolean;
  hasHardwareTransport: boolean;
  onCommand: (cmd: string) => void;
  onConnect: () => void;
  onCopyUid: () => void;
  onOpenTab: (tab: string) => void;
  onRefreshTag: () => void;
  libraryKeyMode: LibraryKeyMode;
  onLibraryKeyModeChange: (mode: LibraryKeyMode) => void;
}

export function SidebarPane({
  canRunCommands,
  commandHistory,
  isDeviceConnected,
  hasHardwareTransport,
  onCommand,
  onConnect,
  onCopyUid,
  onOpenTab,
  onRefreshTag,
  libraryKeyMode,
  onLibraryKeyModeChange,
}: SidebarPaneProps) {
  const { target } = useTarget();
  const tagInfo = target.identity;
  const { jobs } = useCommands();
  return (
    <div className="order-1 flex min-h-0 flex-col gap-4 md:order-1">
      <TagInfoPanel
        tagInfo={tagInfo}
        onRefresh={onRefreshTag}
        onCopyUid={onCopyUid}
        onCommand={onCommand}
        disabled={!canRunCommands}
        libraryKeyMode={libraryKeyMode}
        matchingKeyCount={target.savedKeyCount}
        libraryKeyCount={target.libraryKeyCount}
        onLibraryKeyModeChange={onLibraryKeyModeChange}
      />

      <Card className="overflow-hidden border-border/80 bg-card/80 backdrop-blur md:flex-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            This Session
            {jobs.length > 0 ? (
              <span className="ml-auto text-[10px] font-normal uppercase tracking-wide text-muted-foreground/70">
                {jobs.length} command{jobs.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          {jobs.length > 0 ? (
            <div className="space-y-1.5">
              {jobs.slice(0, 12).map((job) => (
                <button
                  key={job.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-xs font-mono text-muted-foreground transition-colors hover:border-border hover:bg-secondary/40 hover:text-foreground"
                  onClick={() => onCommand(job.command)}
                  title={`${JOB_STATUS_LABEL[job.status]} · click to run again`}
                >
                  <JobStatusIcon status={job.status} />
                  <span className="min-w-0 flex-1 truncate">{job.command}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {jobDuration(job) ?? JOB_STATUS_LABEL[job.status]}
                  </span>
                </button>
              ))}
            </div>
          ) : commandHistory.length > 0 ? (
            <div className="space-y-1.5">
              <p className="px-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                From earlier sessions
              </p>
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
                  disabled={!isDeviceConnected && !hasHardwareTransport}
                  onClick={() => {
                    if (isDeviceConnected) {
                      onCommand("hw version");
                    } else {
                      onConnect();
                    }
                  }}
                >
                  {isDeviceConnected
                    ? "Reader Info"
                    : hasHardwareTransport
                      ? "Connect Reader"
                      : "Reader Unavailable Here"}
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
                  onClick={() => onOpenTab("memory")}
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
