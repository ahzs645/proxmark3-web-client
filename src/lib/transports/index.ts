/**
 * Transport module exports
 */

import type { TransportInfo, TransportType } from "./types";

export * from "./types";
export { WebSerialTransport } from "./WebSerialTransport";
export { WebBluetoothTransport } from "./WebBluetoothTransport";
export { TauriSerialTransport } from "./TauriSerialTransport";
export { TauriBluetoothTransport } from "./TauriBluetoothTransport";
export {
  TauriTcpTransport,
  DEFAULT_TCP_ENDPOINT,
  TCP_ENDPOINT_STORAGE_KEY,
  loadStoredTcpEndpoint,
  normalizeTcpEndpoint,
} from "./TauriTcpTransport";
export { TransportManager, getTransportManager } from "./TransportManager";

const TRANSPORT_LABELS: Record<TransportType, string> = {
  webserial: "WebSerial",
  webbluetooth: "Bluetooth LE",
  "tauri-serial": "Native Serial",
  "tauri-bluetooth": "Bluetooth",
  "tauri-tcp": "Wi-Fi / TCP",
};

/** Transports that reach the device wirelessly (Proxmark5 BWM, Proxmark3 X). */
export function isWirelessTransport(type: TransportType | null | undefined): boolean {
  return type === "webbluetooth" || type === "tauri-bluetooth" || type === "tauri-tcp";
}

/** Human-readable label for a transport, preferring the live TransportInfo name. */
export function getTransportLabel(
  type: TransportType | null | undefined,
  transports?: TransportInfo[],
): string {
  const infoName = type ? transports?.find((t) => t.type === type)?.name : undefined;
  if (infoName) return infoName;
  return type ? TRANSPORT_LABELS[type] : "Auto Select";
}
