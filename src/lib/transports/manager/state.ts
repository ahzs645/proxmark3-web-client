import type { Transport, TransportEventHandlers, TransportType } from "../types";

export interface TransportManagerState {
  transports: Map<TransportType, Transport>;
  activeTransport: Transport | null;
  eventHandlers: TransportEventHandlers;
}

export function createTransportManagerState(): TransportManagerState {
  return {
    transports: new Map(),
    activeTransport: null,
    eventHandlers: {},
  };
}
