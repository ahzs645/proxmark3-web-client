/**
 * ConnectControl - the ribbon's Connect button, as a split dropdown.
 *
 * The plain button connects with the currently selected transport; the caret
 * opens a menu so you can pick a transport (USB / Bluetooth LE / Wi-Fi …) and
 * connect in one action. When only one transport is available it degrades to a
 * plain button, and while connected it becomes a single Disconnect button.
 */

import { Bluetooth, Cable, ChevronDown, Loader2, Usb, Wifi } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RIBBON_CONTROL } from "@/features/ribbon/primitives";
import { cn } from "@/lib/utils";
import type { TransportInfo, TransportType } from "@/lib/transports";

function transportIcon(type: TransportType): ReactNode {
  switch (type) {
    case "webbluetooth":
    case "tauri-bluetooth":
      return <Bluetooth />;
    case "tauri-tcp":
      return <Wifi />;
    case "tauri-serial":
      return <Cable />;
    default:
      return <Usb />;
  }
}

/** Short label shown in the menu; falls back to the live transport name. */
function transportLabel(type: TransportType, transports: TransportInfo[]): string {
  const known: Partial<Record<TransportType, string>> = {
    webserial: "USB (WebSerial)",
    webbluetooth: "Bluetooth LE",
    "tauri-serial": "Native USB",
    "tauri-bluetooth": "Bluetooth (SPP)",
    "tauri-tcp": "Wi-Fi / TCP",
  };
  return known[type] ?? transports.find((t) => t.type === type)?.name ?? type;
}

const TRANSPORT_HINT: Partial<Record<TransportType, string>> = {
  webserial: "Proxmark3 / Proxmark5 over USB",
  webbluetooth: "Proxmark5 Battery/Wireless Module",
  "tauri-serial": "Native serial port",
  "tauri-bluetooth": "Proxmark3 X (Bluetooth Classic)",
  "tauri-tcp": "Proxmark5 BWM Wi-Fi or a TCP bridge",
};

interface ConnectControlProps {
  isConnected: boolean;
  isConnecting: boolean;
  disabled?: boolean;
  availableTransports: TransportInfo[];
  selectedTransport: TransportType | null;
  /** Connect; with an explicit transport when chosen from the menu. */
  onConnect: (transport?: TransportType) => void;
  onDisconnect: () => void;
  onTransportChange?: (type: TransportType) => void;
}

export function ConnectControl({
  isConnected,
  isConnecting,
  disabled = false,
  availableTransports,
  selectedTransport,
  onConnect,
  onDisconnect,
  onTransportChange,
}: ConnectControlProps) {
  const currentType = selectedTransport ?? availableTransports[0]?.type ?? null;
  const hasChoice = availableTransports.length > 1;

  if (isConnected) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={onDisconnect}
        disabled={disabled || isConnecting}
        className={RIBBON_CONTROL}
      >
        {currentType ? transportIcon(currentType) : <Usb />}
        Disconnect
      </Button>
    );
  }

  const connectDisabled = disabled || isConnecting || availableTransports.length === 0;
  const label = isConnecting ? "Connecting…" : "Connect";
  const icon = isConnecting ? (
    <Loader2 className="animate-spin" />
  ) : currentType ? (
    transportIcon(currentType)
  ) : (
    <Usb />
  );

  // A single transport (or none) needs no menu.
  if (!hasChoice) {
    return (
      <Button
        variant="default"
        size="sm"
        onClick={() => onConnect()}
        disabled={connectDisabled}
        className={RIBBON_CONTROL}
      >
        {icon}
        {label}
      </Button>
    );
  }

  const pick = (type: TransportType) => {
    onTransportChange?.(type);
    onConnect(type);
  };

  return (
    <div className="flex shrink-0 items-stretch">
      <Button
        variant="default"
        size="sm"
        onClick={() => onConnect()}
        disabled={connectDisabled}
        className={cn(RIBBON_CONTROL, "rounded-r-none")}
      >
        {icon}
        {label}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="default"
            size="sm"
            disabled={connectDisabled}
            aria-label="Choose connection transport"
            className={cn(RIBBON_CONTROL, "rounded-l-none border-l border-background/30 px-1.5")}
          >
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Connect via</DropdownMenuLabel>
          {availableTransports.map((transport) => (
            <DropdownMenuItem
              key={transport.type}
              onSelect={() => pick(transport.type)}
              className="flex-col items-start gap-0.5"
            >
              <span className="flex items-center gap-2 font-medium">
                {transportIcon(transport.type)}
                {transportLabel(transport.type, availableTransports)}
                {transport.type === currentType ? (
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    current
                  </span>
                ) : null}
              </span>
              {TRANSPORT_HINT[transport.type] ? (
                <span className="pl-6 text-[10px] text-muted-foreground">
                  {TRANSPORT_HINT[transport.type]}
                </span>
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default ConnectControl;
