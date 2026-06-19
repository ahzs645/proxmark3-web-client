import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, StopCircle } from "lucide-react";
import { RIBBON_TABS, getIcon } from "./config";
import type { ConnectionStatus } from "./types";
import type { Theme } from "@/hooks/useTheme";

interface RibbonTabNavProps {
  connectionStatus: ConnectionStatus;
  activeTransportLabel: string;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onStopOperation?: () => void;
  onHardReset?: () => void;
  commandsEnabled: boolean;
}

export function RibbonTabNav({
  connectionStatus,
  activeTransportLabel,
  theme,
  onThemeChange,
  onStopOperation,
  onHardReset,
  commandsEnabled,
}: RibbonTabNavProps) {
  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  return (
    <div className="relative flex items-center gap-2 px-2 py-1.5">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-card via-card/85 to-transparent" />
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-hide">
        <TabsList className="h-auto min-w-max gap-1 bg-transparent p-0">
          {RIBBON_TABS.map((tab) => (
            <RibbonNavTrigger key={tab.value} tab={tab} />
          ))}
        </TabsList>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span className="hidden text-[10px] text-muted-foreground 2xl:inline">
          {activeTransportLabel}
        </span>
        <Badge variant={isConnected ? "success" : "secondary"} className="text-[10px]">
          {isConnected ? "Connected" : isConnecting ? "Connecting…" : "Disconnected"}
        </Badge>
        <Separator orientation="vertical" className="mx-0.5 h-4" />
        <TooltipProvider delayDuration={300}>
          {onStopOperation ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={onStopOperation}
                  disabled={!commandsEnabled}
                  className="h-6 w-6"
                  aria-label="Stop operation"
                >
                  <StopCircle className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Stop operation (Ctrl+C)</TooltipContent>
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

function RibbonNavTrigger({ tab }: { tab: (typeof RIBBON_TABS)[number] }) {
  return (
    <>
      {tab.separatorBefore ? (
        <Separator orientation="vertical" className="mx-1 h-5 shrink-0" />
      ) : null}
      <TabsTrigger
        value={tab.value}
        className="shrink-0 gap-1 rounded-none bg-transparent px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
      >
        {tab.icon ? getIcon(tab.icon, "h-3 w-3") : null}
        {tab.label}
      </TabsTrigger>
    </>
  );
}

export default RibbonTabNav;
