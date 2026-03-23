import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface SessionDashboardProps {
  isLoading: boolean;
  canRunCommands: boolean;
  isDeviceConnected: boolean;
  activeTransportLabel: string;
  activeDumpName?: string;
  cacheCount: number;
  dumpCount: number;
  commandCount: number;
  onToggleConnection: () => void;
  onOpenMemory: () => void;
  onOpenShortcuts: () => void;
  onRunHfSearch: () => void;
}

export function SessionDashboard({
  isLoading,
  canRunCommands,
  isDeviceConnected,
  activeTransportLabel,
  activeDumpName,
  cacheCount,
  dumpCount,
  commandCount,
  onToggleConnection,
  onOpenMemory,
  onOpenShortcuts,
  onRunHfSearch,
}: SessionDashboardProps) {
  const sessionHeadline = isLoading
    ? "Booting the Proxmark3 workspace"
    : canRunCommands && isDeviceConnected
      ? "Live hardware session"
      : canRunCommands
        ? "Offline tools are ready"
        : "Client attention needed";
  const sessionDescription = isLoading
    ? "The WASM client is starting up. Once it finishes, you can connect a reader or work with cached dumps."
    : canRunCommands && isDeviceConnected
      ? "Your reader is connected. Use the ribbon for guided actions or send raw commands from the terminal."
      : canRunCommands
        ? "The client is ready for dump analysis, cache management, and command prep even before a device is connected."
        : "Reload or reset the workspace if the client does not finish initializing.";

  return (
    <Card className="border-border/80 bg-card/70 shadow-sm backdrop-blur">
      <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={canRunCommands ? "success" : isLoading ? "warning" : "secondary"}>
                {canRunCommands ? "Engine Ready" : isLoading ? "Booting" : "Offline"}
              </Badge>
              <Badge variant="outline">{activeTransportLabel}</Badge>
              <Badge variant="outline">
                {isDeviceConnected ? "Reader Connected" : "Reader Disconnected"}
              </Badge>
              {activeDumpName ? (
                <Badge variant="outline">Active Dump: {activeDumpName}</Badge>
              ) : null}
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{sessionHeadline}</h2>
              <p className="max-w-3xl text-sm text-muted-foreground">{sessionDescription}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <div className="rounded-full border border-border/70 bg-background/60 px-3 py-1.5">
              Cache <span className="ml-1 font-medium text-foreground">{cacheCount}</span>
            </div>
            <div className="rounded-full border border-border/70 bg-background/60 px-3 py-1.5">
              Dumps <span className="ml-1 font-medium text-foreground">{dumpCount}</span>
            </div>
            <div className="rounded-full border border-border/70 bg-background/60 px-3 py-1.5">
              Commands <span className="ml-1 font-medium text-foreground">{commandCount}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onToggleConnection}>
            {isDeviceConnected ? "Disconnect Reader" : "Connect Reader"}
          </Button>
          <Button size="sm" variant="secondary" onClick={onRunHfSearch} disabled={!canRunCommands}>
            HF Search
          </Button>
          <Button size="sm" variant="outline" onClick={onOpenMemory}>
            Open Memory
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenShortcuts}>
            Shortcuts
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
