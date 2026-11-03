import { FlaskConical, HelpCircle, Power, PowerOff, RefreshCw, Settings, Zap } from "lucide-react";
import { useContext, useState } from "react";
import { ConnectControl } from "@/components/ribbon/ConnectControl";
import { Input } from "@/components/ui/input";
import { DeviceProfileContext } from "@/features/device/context";
import { normalizeTcpEndpoint, type TransportInfo, type TransportType } from "@/lib/transports";
import { RibbonStrip, RibbonDivider, RibbonGroup, RibbonButton } from "../primitives";
import type { ConnectionStatus } from "../types";

interface ConnectTabProps {
  connectionStatus: ConnectionStatus;
  onConnect: (transport?: TransportType) => void;
  onDisconnect: () => void;
  onCommand: (cmd: string) => void;
  commandsEnabled: boolean;
  availableTransports?: TransportInfo[];
  selectedTransport?: TransportType | null;
  onTransportChange?: (type: TransportType) => void;
  tcpEndpoint?: string;
  onTcpEndpointChange?: (endpoint: string) => void;
  simulatedMode?: boolean;
  onToggleSimulated?: () => void;
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
  tcpEndpoint = "",
  onTcpEndpointChange,
  simulatedMode = false,
  onToggleSimulated,
}: ConnectTabProps) {
  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  // `hw bwm autooff` only exists on a PM5 built with the BWM extras. Reading the
  // context rather than taking a prop keeps the ribbon's plumbing unchanged; a
  // tab rendered outside the provider simply hides the control.
  const isPm5 = useContext(DeviceProfileContext)?.profile.hardwareVariant === "pm5";
  // The firmware stores the switch on the BWM, so it survives reboots. This
  // tracks what this session last sent, starting from the firmware default;
  // `hw bwm autooff` with no argument prints the stored value.
  const [autoOffEnabled, setAutoOffEnabled] = useState(true);
  const hasTransport = availableTransports.length > 0;
  const isTcp = selectedTransport === "tauri-tcp";
  const tcpEndpointValid = !isTcp || normalizeTcpEndpoint(tcpEndpoint) !== null;

  return (
    <RibbonStrip>
      <RibbonGroup title="Connection">
        <ConnectControl
          isConnected={isConnected}
          isConnecting={isConnecting}
          disabled={simulatedMode || (!isConnected && !tcpEndpointValid)}
          availableTransports={availableTransports}
          selectedTransport={selectedTransport}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onTransportChange={onTransportChange}
        />
        <RibbonButton
          icon={<RefreshCw />}
          label="Reconnect"
          onClick={() => {
            onDisconnect();
            setTimeout(onConnect, 500);
          }}
          disabled={
            simulatedMode || !commandsEnabled || isConnecting || !hasTransport || !tcpEndpointValid
          }
        />
      </RibbonGroup>

      {isTcp && onTcpEndpointChange ? (
        <>
          <RibbonDivider />
          <div className="flex flex-col gap-1 shrink-0">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1">
              TCP endpoint
            </div>
            <Input
              value={tcpEndpoint}
              onChange={(event) => onTcpEndpointChange(event.target.value)}
              placeholder="192.168.1.100:18888"
              spellCheck={false}
              disabled={isConnected || isConnecting}
              aria-invalid={!tcpEndpointValid}
              className={`h-7 w-44 font-mono text-xs ${tcpEndpointValid ? "" : "border-destructive"}`}
              title="Proxmark5 BWM Wi-Fi server (hw bwm wifi, default port 18888) or a PM3 TCP bridge"
            />
            <div className="text-[9px] text-muted-foreground px-1">
              {isConnected ? "Disconnect to change" : "host:port from `hw bwm wifi status`"}
            </div>
          </div>
        </>
      ) : null}

      {onToggleSimulated ? (
        <>
          <RibbonDivider />
          <RibbonGroup title="Simulation">
            <RibbonButton
              icon={<FlaskConical className={simulatedMode ? "text-amber-500" : ""} />}
              label={simulatedMode ? "Simulating" : "Simulate"}
              onClick={onToggleSimulated}
              variant={simulatedMode ? "default" : "outline"}
            />
          </RibbonGroup>
        </>
      ) : null}

      {simulatedMode ? (
        <div className="flex h-16 max-w-xs shrink-0 items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-3 text-[11px] leading-snug text-amber-700 dark:text-amber-300">
          Simulated mode is on — every command runs against a virtual card. Turn it off to use real
          hardware.
        </div>
      ) : !hasTransport ? (
        <div className="flex h-16 max-w-xs shrink-0 items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-3 text-[11px] leading-snug text-amber-700 dark:text-amber-300">
          No WebSerial in this browser — hardware connection requires Chrome/Edge on desktop.
          Offline tools still work.
        </div>
      ) : null}

      <RibbonDivider />

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
        {isPm5 ? (
          <RibbonButton
            icon={autoOffEnabled ? <Power /> : <PowerOff className="text-amber-500" />}
            label={autoOffEnabled ? "Auto-off: On" : "Auto-off: Off"}
            onClick={() => {
              const next = !autoOffEnabled;
              setAutoOffEnabled(next);
              onCommand(`hw bwm autooff ${next ? "on" : "off"}`);
            }}
            disabled={!commandsEnabled}
            title={
              autoOffEnabled
                ? "The PM5 powers itself down when USB is unplugged. Turn this off before going wireless, or the board dies while the BWM keeps advertising. Stored on the module."
                : "The PM5 stays powered after USB is unplugged, so it can be used over BLE on battery. Stored on the module."
            }
          />
        ) : null}
      </RibbonGroup>
    </RibbonStrip>
  );
}

export default ConnectTab;
