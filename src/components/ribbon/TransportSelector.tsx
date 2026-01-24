/**
 * TransportSelector - UI component for selecting connection transport
 * Shows available transports (WebSerial, Native Serial, Bluetooth) when in Tauri
 */

import { Select } from '@/components/ui/select';
import { Usb, Bluetooth, Cable } from 'lucide-react';
import type { TransportType, TransportInfo } from '@/lib/transports';

interface TransportSelectorProps {
  availableTransports: TransportInfo[];
  selectedTransport: TransportType | null;
  onTransportChange: (type: TransportType) => void;
  disabled?: boolean;
  isConnected?: boolean;
}

/**
 * Get icon for a transport type
 */
function getTransportIcon(type: TransportType) {
  switch (type) {
    case 'webserial':
      return <Usb className="h-3 w-3" />;
    case 'tauri-serial':
      return <Cable className="h-3 w-3" />;
    case 'tauri-bluetooth':
      return <Bluetooth className="h-3 w-3" />;
    default:
      return <Usb className="h-3 w-3" />;
  }
}

/**
 * Get short label for transport type
 */
function getTransportLabel(type: TransportType): string {
  switch (type) {
    case 'webserial':
      return 'WebSerial';
    case 'tauri-serial':
      return 'Native USB';
    case 'tauri-bluetooth':
      return 'Bluetooth';
    default:
      return type;
  }
}

export function TransportSelector({
  availableTransports,
  selectedTransport,
  onTransportChange,
  disabled = false,
  isConnected = false,
}: TransportSelectorProps) {
  // Don't show selector if only one transport is available
  if (availableTransports.length <= 1) {
    return null;
  }

  const options = availableTransports.map(transport => ({
    value: transport.type,
    label: getTransportLabel(transport.type),
  }));

  return (
    <div className="flex flex-col gap-1 shrink-0">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1">
        Transport
      </div>
      <div className="flex items-center gap-1">
        {selectedTransport && getTransportIcon(selectedTransport)}
        <Select
          value={selectedTransport || ''}
          onValueChange={(value) => onTransportChange(value as TransportType)}
          options={options}
          disabled={disabled || isConnected}
          className="w-32"
        />
      </div>
      {isConnected && (
        <div className="text-[9px] text-muted-foreground px-1">
          Disconnect to change
        </div>
      )}
    </div>
  );
}

export default TransportSelector;
