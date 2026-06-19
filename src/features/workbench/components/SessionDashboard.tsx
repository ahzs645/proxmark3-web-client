import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MonitorSmartphone, Sparkles } from "lucide-react";

interface SessionDashboardProps {
  isLoading: boolean;
  canRunCommands: boolean;
  isConnecting: boolean;
  isDeviceConnected: boolean;
  hasHardwareTransport: boolean;
  activeTransportLabel: string;
  activeDumpName?: string;
  cacheCount: number;
  dumpCount: number;
  commandCount: number;
  onToggleConnection: () => void;
  onOpenMemory: () => void;
  onOpenShortcuts: () => void;
  onOpenTab: (tab: string) => void;
  onLoadSample: () => void;
  onRunHfSearch: () => void;
}

export function SessionDashboard({
  isLoading,
  canRunCommands,
  isConnecting,
  isDeviceConnected,
  hasHardwareTransport,
  activeDumpName,
  cacheCount,
  dumpCount,
  commandCount,
  onToggleConnection,
  onOpenMemory,
  onOpenShortcuts,
  onOpenTab,
  onLoadSample,
  onRunHfSearch,
}: SessionDashboardProps) {
  const sessionHeadline = isLoading
    ? "Booting the Proxmark3 workspace"
    : canRunCommands && isDeviceConnected
      ? "Live hardware session"
      : isConnecting
        ? "Connecting to reader"
        : canRunCommands
          ? "Offline tools are ready"
          : "Client attention needed";
  const sessionDescription = isLoading
    ? "The WASM client is starting up. Once it finishes, you can connect a reader or work with cached dumps."
    : canRunCommands && isDeviceConnected
      ? "Your reader is connected. Use the ribbon for guided actions or send raw commands from the terminal."
      : isConnecting
        ? "Waiting for the device handshake to finish. Approve the browser prompt if one is shown."
        : canRunCommands
          ? "The client is ready for dump analysis, cache management, and command prep even before a device is connected."
          : "Reload or reset the workspace if the client does not finish initializing.";

  return (
    <Card className="border-border/80 bg-card/70 shadow-sm backdrop-blur">
      <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            {activeDumpName ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Active Dump: {activeDumpName}</Badge>
              </div>
            ) : null}
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

        {!hasHardwareTransport ? (
          <div className="flex flex-col gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <div className="flex items-start gap-2">
              <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>This browser can't connect to Proxmark3 hardware.</strong> WebSerial isn't
                supported on mobile browsers, Firefox, or Safari. You can still explore dumps
                offline — start with the sample below. To connect a reader, open this app in Chrome
                or Edge on desktop.
              </span>
            </div>
            <div className="flex flex-wrap gap-2 sm:pl-6">
              <Button size="sm" variant="outline" onClick={onLoadSample}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Load sample dump
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onOpenTab("memory")}>
                Memory Map
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onOpenTab("hex")}>
                Hex Viewer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onOpenTab("library")}>
                Library
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={onToggleConnection}
            disabled={isConnecting || !hasHardwareTransport}
          >
            {!hasHardwareTransport
              ? "No Hardware Support"
              : isDeviceConnected
                ? "Disconnect Reader"
                : isConnecting
                  ? "Connecting…"
                  : "Connect Reader"}
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
