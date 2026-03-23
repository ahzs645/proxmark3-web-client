import type { TransportDevice, TransportType } from "../types";
import type { TransportManagerState } from "./state";

export function getActiveTransport(
  state: TransportManagerState,
): TransportManagerState["activeTransport"] {
  return state.activeTransport;
}

export function isConnected(state: TransportManagerState): boolean {
  return state.activeTransport?.isConnected ?? false;
}

export function getActiveTransportType(state: TransportManagerState): TransportType | null {
  return state.activeTransport?.type ?? null;
}

export async function connectTransport(
  state: TransportManagerState,
  type: TransportType,
  device?: TransportDevice,
): Promise<boolean> {
  const transport = state.transports.get(type);
  if (!transport) {
    console.error(`Transport ${type} not registered`);
    return false;
  }

  if (!transport.isAvailable()) {
    console.error(`Transport ${type} is not available`);
    return false;
  }

  if (state.activeTransport && state.activeTransport !== transport) {
    await disconnectActiveTransport(state);
  }

  transport.setEventHandlers(state.eventHandlers);

  const success = await transport.connect(device);
  if (success) {
    state.activeTransport = transport;
    transport.startReadLoop();
    transport.startTxLoop();
  }

  return success;
}

export async function disconnectActiveTransport(state: TransportManagerState): Promise<void> {
  if (!state.activeTransport) {
    return;
  }

  await state.activeTransport.disconnect();
  state.activeTransport = null;
}

export async function listDevicesForTransport(
  state: TransportManagerState,
  type: TransportType,
): Promise<TransportDevice[]> {
  const transport = state.transports.get(type);
  if (!transport || !transport.isAvailable()) {
    return [];
  }

  return transport.listDevices();
}
