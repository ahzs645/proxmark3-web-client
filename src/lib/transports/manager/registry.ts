import { isTauri } from "../../tauri";
import { TauriBluetoothTransport } from "../TauriBluetoothTransport";
import { TauriSerialTransport } from "../TauriSerialTransport";
import { TauriTcpTransport } from "../TauriTcpTransport";
import { WebBluetoothTransport } from "../WebBluetoothTransport";
import { WebSerialTransport } from "../WebSerialTransport";
import type { Transport, TransportInfo, TransportType } from "../types";
import type { TransportManagerState } from "./state";

export function registerDefaultTransports(state: TransportManagerState): void {
  // WebSerial is available in browsers and sometimes in Tauri webviews.
  const webSerial = new WebSerialTransport();
  if (webSerial.isAvailable()) {
    state.transports.set(webSerial.type, webSerial);
  }

  // Web Bluetooth reaches the Proxmark5 BWM from Chromium browsers; Tauri's
  // WKWebView/WebKitGTK do not implement it, so this is effectively browser-only.
  const webBluetooth = new WebBluetoothTransport();
  if (webBluetooth.isAvailable()) {
    state.transports.set(webBluetooth.type, webBluetooth);
  }

  if (!isTauri()) {
    return;
  }

  const tauriSerial = new TauriSerialTransport();
  if (tauriSerial.isAvailable()) {
    state.transports.set(tauriSerial.type, tauriSerial);
  }

  const tauriBluetooth = new TauriBluetoothTransport();
  if (tauriBluetooth.isAvailable()) {
    state.transports.set(tauriBluetooth.type, tauriBluetooth);
  }

  const tauriTcp = new TauriTcpTransport();
  if (tauriTcp.isAvailable()) {
    state.transports.set(tauriTcp.type, tauriTcp);
  }
}

export function registerTransport(state: TransportManagerState, transport: Transport): void {
  state.transports.set(transport.type, transport);
}

export function getTransport(
  state: TransportManagerState,
  type: TransportType,
): Transport | undefined {
  return state.transports.get(type);
}

export function getAllTransports(state: TransportManagerState): Transport[] {
  return Array.from(state.transports.values());
}

export function getAvailableTransports(state: TransportManagerState): TransportInfo[] {
  return getAllTransports(state)
    .filter((transport) => transport.isAvailable())
    .map((transport) => ({
      type: transport.type,
      name: transport.getName(),
      available: true,
      description: transport.getDescription(),
    }));
}

export function getDefaultTransportType(state: TransportManagerState): TransportType | null {
  const available = getAvailableTransports(state);
  if (available.length === 0) {
    return null;
  }

  if (isTauri()) {
    const priority: TransportType[] = [
      "tauri-serial",
      "tauri-bluetooth",
      "tauri-tcp",
      "webserial",
      "webbluetooth",
    ];
    for (const type of priority) {
      if (available.some((transport) => transport.type === type)) {
        return type;
      }
    }
  }

  return available[0].type;
}
