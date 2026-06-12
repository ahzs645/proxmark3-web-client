import { Separator } from "@/components/ui/separator";
import { Bluetooth, HelpCircle, RefreshCw, Settings, Usb, Zap } from "lucide-react";
import { TransportSelector } from "@/components/ribbon/TransportSelector";
import type { TransportInfo, TransportType } from "@/lib/transports";
import { RibbonButton, RibbonGroup } from "../primitives";
import type { ConnectionStatus } from "../types";

interface ConnectTabProps {
  connectionStatus: ConnectionStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  onCommand: (cmd: string) => void;
  commandsEnabled: boolean;
  availableTransports?: TransportInfo[];
  selectedTransport?: TransportType | null;
  onTransportChange?: (type: TransportType) => void;
}

export function ConnectTab({
  connectionStatus,
  onConnect,
  onDisconnect,
  onCommand,
  commandsEnabled,
  availableTransports = [],
  selectedTransport = null,
  onTransportChange,
}: ConnectTabProps) {
  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";
  const hasTransport = availableTransports.length > 0;

  return (
    <div className="flex items-start gap-2 overflow-x-auto scrollbar-hide">
      <RibbonGroup title="Connection">
        <RibbonButton
          icon={
            selectedTransport === "tauri-bluetooth" ? (
              <Bluetooth className={isConnected ? "text-blue-500" : ""} />
            ) : (
              <Usb className={isConnected ? "text-green-500" : ""} />
            )
          }
          label={isConnected ? "Disconnect" : isConnecting ? "Connecting…" : "Connect"}
          onClick={isConnected ? onDisconnect : onConnect}
          disabled={isConnecting || (!isConnected && !hasTransport)}
          variant={isConnected ? "secondary" : "default"}
        />
        <RibbonButton
          icon={<RefreshCw />}
          label="Reconnect"
          onClick={() => {
            onDisconnect();
            setTimeout(onConnect, 500);
          }}
          disabled={!commandsEnabled || isConnecting || !hasTransport}
        />
      </RibbonGroup>

      {!hasTransport ? (
        <div className="flex h-16 max-w-xs shrink-0 items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-3 text-[11px] leading-snug text-amber-700 dark:text-amber-300">
          No WebSerial in this browser — hardware connection requires Chrome/Edge on desktop.
          Offline tools still work.
        </div>
      ) : null}

      {availableTransports.length > 1 && onTransportChange ? (
        <>
          <Separator orientation="vertical" className="h-16 shrink-0" />
          <TransportSelector
            availableTransports={availableTransports}
            selectedTransport={selectedTransport}
            onTransportChange={onTransportChange}
            disabled={isConnecting}
            isConnected={isConnected}
          />
        </>
      ) : null}

      <Separator orientation="vertical" className="h-16 shrink-0" />

      <RibbonGroup title="Device">
        <RibbonButton
          icon={<HelpCircle />}
          label="Info"
          onClick={() => onCommand("hw version")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Zap />}
          label="Tune"
          onClick={() => onCommand("hw tune")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Settings />}
          label="Status"
          onClick={() => onCommand("hw status")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>
    </div>
  );
}

export default ConnectTab;
