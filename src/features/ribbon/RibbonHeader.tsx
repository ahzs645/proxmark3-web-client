import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { RefreshCw, StopCircle } from "lucide-react";
import type { ConnectionStatus } from "./types";
import type { Theme } from "@/hooks/useTheme";

interface RibbonHeaderProps {
  connectionStatus: ConnectionStatus;
  activeTransportLabel: string;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onStopOperation?: () => void;
  onHardReset?: () => void;
  commandsEnabled: boolean;
}

export function RibbonHeader({
  connectionStatus,
  activeTransportLabel,
  theme,
  onThemeChange,
  onStopOperation,
  onHardReset,
  commandsEnabled,
}: RibbonHeaderProps) {
  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  return (
    <div className="border-b border-border/70 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Workbench
            </span>
            <Badge variant="outline" className="max-w-full truncate text-[10px]">
              {activeTransportLabel}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">Proxmark3 Control Surface</span>
            <Badge variant={isConnected ? "success" : "secondary"}>
              {isConnected ? "Connected" : isConnecting ? "Connecting..." : "Disconnected"}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {onStopOperation ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={onStopOperation}
              disabled={!commandsEnabled}
              className="h-7 gap-1.5 px-3 text-xs"
              title="Send Ctrl+C to stop current operation"
            >
              <StopCircle className="h-3.5 w-3.5" />
              Stop
            </Button>
          ) : null}
          {onHardReset ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onHardReset}
              className="h-7 gap-1 px-2 text-xs text-orange-600 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-950"
              title="Force reload if stuck (will disconnect)"
            >
              <RefreshCw className="h-3 w-3" />
              Reset
            </Button>
          ) : null}
          <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
        </div>
      </div>
    </div>
  );
}

export default RibbonHeader;
