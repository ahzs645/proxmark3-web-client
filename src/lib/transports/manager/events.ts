import type { TransportEventHandlers } from "../types";
import type { TransportManagerState } from "./state";

export function setEventHandlers(
  state: TransportManagerState,
  handlers: TransportEventHandlers,
): void {
  state.eventHandlers = handlers;
  state.transports.forEach((transport) => {
    transport.setEventHandlers(handlers);
  });
}
