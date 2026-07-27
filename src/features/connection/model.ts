import { getTransportLabel, type TransportInfo, type TransportType } from "@/lib/transports";

/**
 * Getting a command to the hardware takes three things, in order:
 *
 *  1. `runtime` — the Proxmark3 client compiled to WASM finishes booting.
 *  2. `link`    — a transport (WebSerial / Tauri serial / Bluetooth) is opened.
 *  3. `client`  — the client runs `hw connect` against that transport.
 *
 * The UI used to describe these with four different, sometimes contradictory
 * indicators. This module derives all of them from one place so every surface
 * tells the same story, and so "connected" never means two different things.
 */
export type ConnectionPhase =
  | "booting"
  | "runtime-error"
  | "offline"
  | "opening"
  | "attaching"
  | "online";

export type ConnectionTone = "ok" | "warn" | "error" | "idle";

export type StageState = "pending" | "active" | "ok" | "error";

export interface ConnectionStage {
  key: "runtime" | "link" | "client";
  label: string;
  detail: string;
  state: StageState;
}

export interface ConnectionState {
  phase: ConnectionPhase;
  tone: ConnectionTone;
  /** Two or three words for a badge. */
  label: string;
  /** One sentence explaining the phase and what to do about it. */
  detail: string;
  /** True once commands can be dispatched at all (offline tools included). */
  canRunCommands: boolean;
  /** True when commands will actually reach hardware. */
  isLive: boolean;
  transportLabel: string;
  /** Whether this browser/runtime can talk to hardware at all. */
  hasHardwareTransport: boolean;
  stages: ConnectionStage[];
}

export interface ConnectionInputs {
  isReady: boolean;
  error: Error | null;
  /** Transport open. */
  isDeviceConnected: boolean;
  /** `hw connect` completed. */
  isClientAttached: boolean;
  /** `hw connect` in flight. */
  isAttaching: boolean;
  /** A connect attempt is running in the shell (browser picker, handshake). */
  isConnecting: boolean;
  availableTransports: TransportInfo[];
  activeTransportType: TransportType | null;
}

export function deriveConnectionState(input: ConnectionInputs): ConnectionState {
  const {
    isReady,
    error,
    isDeviceConnected,
    isClientAttached,
    isAttaching,
    isConnecting,
    availableTransports,
    activeTransportType,
  } = input;

  const hasHardwareTransport = availableTransports.length > 0;
  const transportLabel = getTransportLabel(
    activeTransportType ?? availableTransports[0]?.type,
    availableTransports,
  );

  const runtimeState: StageState = isReady ? "ok" : error ? "error" : "pending";
  const linkState: StageState = isDeviceConnected ? "ok" : isConnecting ? "active" : "pending";
  const clientState: StageState = isClientAttached
    ? "ok"
    : isAttaching
      ? "active"
      : isDeviceConnected
        ? "pending"
        : "pending";

  const phase: ConnectionPhase = !isReady
    ? error
      ? "runtime-error"
      : "booting"
    : isClientAttached
      ? "online"
      : isAttaching
        ? "attaching"
        : isConnecting
          ? "opening"
          : isDeviceConnected
            ? "attaching"
            : "offline";

  const copy: Record<ConnectionPhase, { label: string; detail: string; tone: ConnectionTone }> = {
    booting: {
      label: "Booting",
      detail: "The Proxmark3 WASM client is starting up.",
      tone: "warn",
    },
    "runtime-error": {
      label: "Client error",
      detail: error ? error.message : "The WASM client failed to load. Try a reload.",
      tone: "error",
    },
    offline: {
      label: "Offline",
      detail: hasHardwareTransport
        ? `Client ready. Connect a reader over ${transportLabel} to run hardware commands.`
        : "Client ready. This browser can't reach hardware, but dumps and offline tools work.",
      tone: "idle",
    },
    opening: {
      label: "Opening port",
      detail: `Waiting for the ${transportLabel} port. Approve the browser prompt if one appears.`,
      tone: "warn",
    },
    attaching: {
      label: "Attaching",
      detail: `Port open — running \`hw connect\` so the client takes over the ${transportLabel} link.`,
      tone: "warn",
    },
    online: {
      label: "Connected",
      detail: `Client attached to the reader over ${transportLabel}.`,
      tone: "ok",
    },
  };

  const { label, detail, tone } = copy[phase];

  return {
    phase,
    tone,
    label,
    detail,
    canRunCommands: isReady,
    isLive: isClientAttached,
    transportLabel,
    hasHardwareTransport,
    stages: [
      {
        key: "runtime",
        label: "WASM client",
        detail: isReady ? "Running" : error ? "Failed to load" : "Loading…",
        state: runtimeState,
      },
      {
        key: "link",
        label: transportLabel,
        detail: isDeviceConnected ? "Port open" : isConnecting ? "Opening…" : "Not connected",
        state: linkState,
      },
      {
        key: "client",
        label: "hw connect",
        detail: isClientAttached ? "Attached" : isAttaching ? "Attaching…" : "Not attached",
        state: clientState,
      },
    ],
  };
}

/** Legacy three-state string still used by the ribbon's connect controls. */
export function toLegacyStatus(
  state: ConnectionState,
): "connected" | "connecting" | "disconnected" {
  if (state.phase === "online") return "connected";
  if (state.phase === "opening" || state.phase === "attaching") return "connecting";
  return "disconnected";
}
