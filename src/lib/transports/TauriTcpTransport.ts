/**
 * Tauri TCP transport - talks to a PM3 protocol endpoint over a plain socket.
 *
 * Primary use: the Proxmark5 Battery/Wireless Module in Wi-Fi station mode.
 * `hw bwm wifi --ssid <ssid> --pwd <pwd> [--port 18888]` (run over USB or BLE)
 * joins a network and starts a TCP server; the upstream client then connects
 * with `pm3 -p tcp:<ip>:<port>`. The same socket also works with the upstream
 * `pm5_ble_bridge.py --tcp` relay or any `socat` serial-to-TCP bridge.
 */

import { uartShared } from "../pm3WebUSB";
import { isTauri, invoke } from "../tauri";
import type { Transport, TransportType, TransportDevice, TransportEventHandlers } from "./types";

export const TCP_ENDPOINT_STORAGE_KEY = "pm3-tcp-endpoint";
/** Matches the default port of upstream `hw bwm wifi`. */
export const DEFAULT_TCP_ENDPOINT = "192.168.1.100:18888";

const ENDPOINT_PATTERN = /^\s*(?:tcp:)?(\[[0-9a-f:.]+\]|[^\s:\][]+):(\d{1,5})\s*$/i;

/** Accepts `host:port`, `tcp:host:port`, or `[v6]:port`; returns a normalised `host:port`. */
export function normalizeTcpEndpoint(value: string): string | null {
  const match = value.match(ENDPOINT_PATTERN);
  if (!match) return null;
  const port = Number(match[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return `${match[1]}:${port}`;
}

export function loadStoredTcpEndpoint(): string {
  if (typeof localStorage === "undefined") return DEFAULT_TCP_ENDPOINT;
  return localStorage.getItem(TCP_ENDPOINT_STORAGE_KEY) || DEFAULT_TCP_ENDPOINT;
}

export class TauriTcpTransport implements Transport {
  readonly type: TransportType = "tauri-tcp";

  private _isConnected = false;
  private readLoopRunning = false;
  private txLoopRunning = false;
  private eventHandlers: TransportEventHandlers = {};
  private endpoint: string | null = null;

  get isConnected(): boolean {
    return this._isConnected;
  }

  /** Endpoint of the live connection, e.g. `192.168.1.42:18888`. */
  get connectedEndpoint(): string | null {
    return this.endpoint;
  }

  isAvailable(): boolean {
    return isTauri();
  }

  async listDevices(): Promise<TransportDevice[]> {
    // There is nothing to enumerate on a network; surface the remembered endpoint.
    const endpoint = loadStoredTcpEndpoint();
    return [{ id: endpoint, name: `tcp:${endpoint}`, type: this.type, address: endpoint }];
  }

  async connect(device?: TransportDevice): Promise<boolean> {
    if (!this.isAvailable()) {
      console.error("Tauri TCP transport not available");
      return false;
    }

    const requested = device?.address || device?.id || loadStoredTcpEndpoint();
    const endpoint = normalizeTcpEndpoint(requested);
    if (!endpoint) {
      const error = new Error(`Invalid TCP endpoint "${requested}" (expected host:port)`);
      this.eventHandlers.onError?.(error);
      return false;
    }

    try {
      const success = await invoke<boolean>("tcp_connect", { address: endpoint });
      if (!success) return false;

      this._isConnected = true;
      this.endpoint = endpoint;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(TCP_ENDPOINT_STORAGE_KEY, endpoint);
      }

      if (window.Module && window.Module.HEAPU8 && window.Module._pm3_uart_rx_head_ptr) {
        uartShared.init(window.Module);
      }

      this.eventHandlers.onConnect?.();
      return true;
    } catch (error) {
      console.error("TCP connection failed:", error);
      this.eventHandlers.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.stopReadLoop();
    this.stopTxLoop();

    try {
      await invoke("tcp_disconnect");
    } catch (error) {
      console.error("Error disconnecting TCP:", error);
    }

    const wasConnected = this._isConnected;
    this._isConnected = false;
    this.endpoint = null;
    if (wasConnected) this.eventHandlers.onDisconnect?.();
  }

  startReadLoop(): void {
    if (this.readLoopRunning) return;
    this.readLoopRunning = true;
    void this.runReadLoop();
  }

  stopReadLoop(): void {
    this.readLoopRunning = false;
  }

  private async runReadLoop(): Promise<void> {
    while (this.readLoopRunning && this._isConnected) {
      try {
        const data = await invoke<number[]>("tcp_read", { maxBytes: 4096 });
        if (data && data.length > 0) {
          const bytes = new Uint8Array(data);
          let offset = 0;
          while (offset < bytes.length && this._isConnected) {
            offset += uartShared.pushRx(bytes.subarray(offset), false);
            if (offset < bytes.length) await new Promise((resolve) => setTimeout(resolve, 1));
          }
          this.eventHandlers.onData?.(bytes);
          continue;
        }
      } catch (error) {
        // The Rust side reports a closed socket as an error.
        console.warn("TCP read stopped:", error);
        this._isConnected = false;
        this.readLoopRunning = false;
        this.txLoopRunning = false;
        this.endpoint = null;
        this.eventHandlers.onDisconnect?.("lost");
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  startTxLoop(): void {
    if (this.txLoopRunning) return;
    this.txLoopRunning = true;
    void this.runTxLoop();
  }

  stopTxLoop(): void {
    this.txLoopRunning = false;
  }

  private async runTxLoop(): Promise<void> {
    const tmp = new Uint8Array(4096);

    while (this.txLoopRunning && this._isConnected) {
      try {
        const n = uartShared.popTx(tmp.length, tmp);
        if (n > 0) {
          await invoke("tcp_write", { data: Array.from(tmp.subarray(0, n)) });
        } else {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      } catch (error) {
        console.error("TCP TX error:", error);
        this.eventHandlers.onError?.(error instanceof Error ? error : new Error(String(error)));
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }

  setEventHandlers(handlers: TransportEventHandlers): void {
    this.eventHandlers = handlers;
  }

  getName(): string {
    return "Wi-Fi / TCP";
  }

  getDescription(): string {
    return "Connect to a Proxmark5 BWM Wi-Fi server or any PM3 TCP bridge (Tauri)";
  }
}

export default TauriTcpTransport;
