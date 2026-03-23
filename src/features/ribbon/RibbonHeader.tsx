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
    <div className="flex items-center gap-3 border-b border-border/70 px-3 py-1.5">
      <span className="text-sm font-semibold tracking-tight">Proxmark3</span>
      <span className="text-[10px] text-muted-foreground">{activeTransportLabel}</span>
      <Badge variant={isConnected ? "success" : "secondary"} className="text-[10px]">
        {isConnected ? "Connected" : isConnecting ? "Connecting…" : "Disconnected"}
      </Badge>

      <div className="ml-auto flex items-center gap-1.5">
        {onStopOperation ? (
          <Button
            variant="destructive"
            size="icon"
            onClick={onStopOperation}
            disabled={!commandsEnabled}
            className="h-6 w-6"
            title="Send Ctrl+C to stop current operation"
          >
            <StopCircle className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {onHardReset ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onHardReset}
            className="h-6 w-6 text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950"
            title="Force reload if stuck (will disconnect)"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        ) : null}
        <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
      </div>
    </div>
  );
}

export default RibbonHeader;
