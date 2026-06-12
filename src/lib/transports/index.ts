/**
 * Transport module exports
 */

import type { TransportInfo, TransportType } from "./types";

export * from "./types";
export { WebSerialTransport } from "./WebSerialTransport";
export { TauriSerialTransport } from "./TauriSerialTransport";
export { TauriBluetoothTransport } from "./TauriBluetoothTransport";
export { TransportManager, getTransportManager } from "./TransportManager";

const TRANSPORT_LABELS: Record<TransportType, string> = {
  webserial: "WebSerial",
  "tauri-serial": "Native Serial",
  "tauri-bluetooth": "Bluetooth",
};

/** Human-readable label for a transport, preferring the live TransportInfo name. */
export function getTransportLabel(
  type: TransportType | null | undefined,
  transports?: TransportInfo[],
): string {
  const infoName = type ? transports?.find((t) => t.type === type)?.name : undefined;
  if (infoName) return infoName;
  return type ? TRANSPORT_LABELS[type] : "Auto Select";
}
