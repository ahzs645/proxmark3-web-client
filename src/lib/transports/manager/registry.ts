import { isTauri } from "../../tauri";
import { TauriBluetoothTransport } from "../TauriBluetoothTransport";
import { TauriSerialTransport } from "../TauriSerialTransport";
import { WebSerialTransport } from "../WebSerialTransport";
import type { Transport, TransportInfo, TransportType } from "../types";
import type { TransportManagerState } from "./state";

export function registerDefaultTransports(state: TransportManagerState): void {
  // WebSerial is available in browsers and sometimes in Tauri webviews.
  const webSerial = new WebSerialTransport();
  if (webSerial.isAvailable()) {
    state.transports.set(webSerial.type, webSerial);
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
    const priority: TransportType[] = ["tauri-serial", "tauri-bluetooth", "webserial"];
    for (const type of priority) {
      if (available.some((transport) => transport.type === type)) {
        return type;
      }
    }
  }

  return available[0].type;
}
