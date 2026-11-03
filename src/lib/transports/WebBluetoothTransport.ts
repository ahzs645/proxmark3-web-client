/**
 * Web Bluetooth (BLE) transport for the Proxmark5 Battery/Wireless Module and
 * BLE UART add-ons (see ./bleUart for the profiles).
 *
 * The BWM's ESP32 exposes a NimBLE "SPP" service (see
 * RfidResearchGroup/Proxmark5_BWM_esp32, components/app_ble_spp):
 *   - advertised name  "Proxmark5"
 *   - service          0xAE86 (16-bit)
 *   - data char        0xAE88 (WRITE / WRITE_NO_RSP / NOTIFY)
 *   - no pairing, plaintext GATT
 * Bytes written to the characteristic reach the PM5 UART; device output arrives
 * as notifications. That is a plain byte pipe, so the same ring buffers used by
 * the serial transports carry the PM3 protocol unchanged. Nordic UART and HM-10
 * bridges are the same pipe on different UUIDs.
 */

import { loadSettingsFromStorage } from "@/features/settings/storage";
import { uartShared } from "../pm3WebUSB";
import { bleRequestOptions, bleUartProfiles, type BleUartProfile } from "./bleUart";
import type { Transport, TransportType, TransportDevice, TransportEventHandlers } from "./types";

export const PM5_BLE_BATTERY_SERVICE_UUID = 0x180f;

/**
 * Web Bluetooth does not expose the negotiated ATT MTU. The BWM negotiates
 * MTU 512 with upstream's native transport, but a host stack may settle lower,
 * and a write longer than MTU-3 fails outright. Start optimistic and step down
 * to the always-safe 20-byte payload after a failure.
 */
const WRITE_CHUNK_SIZES = [244, 128, 20] as const;

/**
 * Link diagnostics. A GATT connection succeeding says nothing about whether the
 * PM5 behind the BWM is reachable: the ESP32 accepts the browser either way. The
 * counters below separate the cases when `hw connect` then reports "cannot
 * communicate" — read them from the devtools console as `__pm3Ble`.
 *
 *   txWrites > 0, rxNotifications === 0  -> nothing came back; suspect the PM5
 *       fullimage (needs PLATFORM=PM5 PLATFORM_EXTRAS=BWM, else receive_ng()
 *       never reads the BWM UART) or a BWM that is not bridging.
 *   rxNotifications > 0                  -> bytes flow; compare lastRxHex with a
 *       PM3 NG response preamble (4d 33 62 50 ...) to see if the BLE payload is
 *       raw or still wrapped in BWM app_com framing.
 *   txWrites === 0                       -> the client never queued anything;
 *       the WASM ring buffer bridge, not Bluetooth, is at fault.
 */
export interface BleLinkStats {
  profile: BleUartProfile["id"] | null;
  properties: string[];
  chunkSize: number;
  txWrites: number;
  txBytes: number;
  rxNotifications: number;
  rxBytes: number;
  lastTxHex: string | null;
  lastRxHex: string | null;
  lastError: string | null;
}

const TRACE_FRAME_LIMIT = 8;

const stats: BleLinkStats = {
  profile: null,
  properties: [],
  chunkSize: WRITE_CHUNK_SIZES[0],
  txWrites: 0,
  txBytes: 0,
  rxNotifications: 0,
  rxBytes: 0,
  lastTxHex: null,
  lastRxHex: null,
  lastError: null,
};

export function getBleLinkStats(): BleLinkStats {
  return { ...stats };
}

function resetStats(): void {
  stats.profile = null;
  stats.properties = [];
  stats.chunkSize = WRITE_CHUNK_SIZES[0];
  stats.txWrites = 0;
  stats.txBytes = 0;
  stats.rxNotifications = 0;
  stats.rxBytes = 0;
  stats.lastTxHex = null;
  stats.lastRxHex = null;
  stats.lastError = null;
}

function toHex(bytes: Uint8Array, max = 32): string {
  const head = Array.from(bytes.subarray(0, max), (b) => b.toString(16).padStart(2, "0")).join(" ");
  return bytes.length > max ? `${head} ... (+${bytes.length - max})` : head;
}

if (typeof window !== "undefined") {
  (window as Window & { __pm3Ble?: () => BleLinkStats }).__pm3Ble = getBleLinkStats;
}

export class WebBluetoothTransport implements Transport {
  readonly type: TransportType = "webbluetooth";

  private device: BluetoothDevice | null = null;
  /** Same object as `notifyCharacteristic` on single-characteristic bridges. */
  private writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private notifyCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private _isConnected = false;
  private txLoopRunning = false;
  private eventHandlers: TransportEventHandlers = {};
  private chunkSizeIndex = 0;
  private rxQueue: Uint8Array[] = [];
  private rxDrainScheduled = false;

  private readonly onNotification = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic | null;
    const value = target?.value;
    if (!value || value.byteLength === 0) return;
    const bytes = new Uint8Array(
      value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
    );
    stats.rxNotifications += 1;
    stats.rxBytes += bytes.length;
    stats.lastRxHex = toHex(bytes);
    if (stats.rxNotifications <= TRACE_FRAME_LIMIT) {
      console.debug(`[WebBluetooth] rx ${bytes.length}: ${stats.lastRxHex}`);
    }
    this.rxQueue.push(bytes);
    this.eventHandlers.onData?.(bytes);
    void this.drainRxQueue();
  };

  private readonly onGattDisconnected = () => {
    if (!this._isConnected) return;
    this._isConnected = false;
    this.txLoopRunning = false;
    this.writeCharacteristic = null;
    this.notifyCharacteristic = null;
    this.eventHandlers.onDisconnect?.("lost");
  };

  get isConnected(): boolean {
    return this._isConnected;
  }

  isAvailable(): boolean {
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.bluetooth?.requestDevice === "function" &&
      (typeof window === "undefined" || window.isSecureContext)
    );
  }

  async listDevices(): Promise<TransportDevice[]> {
    // Chrome only lists devices the user has already granted (and the picker
    // only offers supported bridges); the picker runs during connect() when
    // nothing is remembered.
    const known = await navigator.bluetooth?.getDevices?.().catch(() => []);
    return (known ?? []).map((entry) => ({
      id: entry.id,
      name: entry.name ?? "Bluetooth device",
      type: this.type,
      address: entry.id,
    }));
  }

  async connect(device?: TransportDevice): Promise<boolean> {
    if (!this.isAvailable()) {
      console.error("Web Bluetooth is not available in this browser");
      return false;
    }

    try {
      let target: BluetoothDevice | undefined;
      if (device) {
        const known = await navigator.bluetooth?.getDevices?.().catch(() => []);
        target = known?.find((entry) => entry.id === (device.address || device.id));
      }
      const settings = loadSettingsFromStorage();
      const profiles = bleUartProfiles({
        service: settings.bleCustomServiceUuid,
        write: settings.bleCustomWriteUuid,
        notify: settings.bleCustomNotifyUuid,
      });
      target ??= await navigator.bluetooth!.requestDevice(
        bleRequestOptions(profiles, [PM5_BLE_BATTERY_SERVICE_UUID]),
      );
      if (!target.gatt) throw new Error("Selected device does not expose GATT");

      const server = await target.gatt.connect();
      const link = await this.openUart(server, profiles);
      if (!link) {
        throw new Error(
          `${target.name ?? "The device"} has no supported BLE UART service ` +
            `(tried ${profiles.map((profile) => profile.label).join(", ")}). ` +
            "Set its UUIDs under Settings → Bluetooth UART.",
        );
      }
      const { profile, write, notify } = link;
      await notify.startNotifications();
      notify.addEventListener("characteristicvaluechanged", this.onNotification);
      target.addEventListener("gattserverdisconnected", this.onGattDisconnected);

      resetStats();
      stats.profile = profile.id;
      stats.properties = [
        write.properties.write ? "write" : null,
        write.properties.writeWithoutResponse ? "writeWithoutResponse" : null,
        notify.properties.notify ? "notify" : null,
        notify.properties.indicate ? "indicate" : null,
      ].filter((name): name is string => name !== null);
      console.info(
        `[WebBluetooth] connected to ${target.name ?? "(unnamed)"} via ${profile.label}; ` +
          `properties: ${stats.properties.join(", ") || "(none)"}`,
      );
      if (!notify.properties.notify && !notify.properties.indicate) {
        console.warn(
          "[WebBluetooth] data characteristic advertises neither notify nor indicate; " +
            "device output cannot reach the client",
        );
      }

      this.device = target;
      this.writeCharacteristic = write;
      this.notifyCharacteristic = notify;
      this.chunkSizeIndex = 0;
      this.rxQueue = [];
      this._isConnected = true;

      if (window.Module && window.Module.HEAPU8 && window.Module._pm3_uart_rx_head_ptr) {
        uartShared.init(window.Module);
      }

      this.eventHandlers.onConnect?.();
      return true;
    } catch (error) {
      console.error("Web Bluetooth connection failed:", error);
      stats.lastError = error instanceof Error ? error.message : String(error);
      await this.teardown();
      this.eventHandlers.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /** First profile whose service and characteristics the device actually has. */
  private async openUart(
    server: BluetoothRemoteGATTServer,
    profiles: readonly BleUartProfile[],
  ): Promise<{
    profile: BleUartProfile;
    write: BluetoothRemoteGATTCharacteristic;
    notify: BluetoothRemoteGATTCharacteristic;
  } | null> {
    for (const profile of profiles) {
      try {
        const service = await server.getPrimaryService(profile.service);
        const write = await service.getCharacteristic(profile.write);
        const notify =
          profile.notify === profile.write
            ? write
            : await service.getCharacteristic(profile.notify);
        return { profile, write, notify };
      } catch {
        // Not this bridge; try the next profile.
      }
    }
    return null;
  }

  private async teardown(): Promise<void> {
    const characteristic = this.notifyCharacteristic;
    const device = this.device;
    this.writeCharacteristic = null;
    this.notifyCharacteristic = null;
    this.device = null;
    if (characteristic) {
      characteristic.removeEventListener("characteristicvaluechanged", this.onNotification);
      try {
        await characteristic.stopNotifications();
      } catch {
        // The link may already be gone.
      }
    }
    if (device) {
      device.removeEventListener("gattserverdisconnected", this.onGattDisconnected);
      if (device.gatt?.connected) device.gatt.disconnect();
    }
  }

  async disconnect(): Promise<void> {
    this.stopReadLoop();
    this.stopTxLoop();
    const wasConnected = this._isConnected;
    this._isConnected = false;
    await this.teardown();
    if (wasConnected) this.eventHandlers.onDisconnect?.();
  }

  /**
   * Notifications cannot be paused, so incoming bytes are queued here and moved
   * into the WASM ring buffer as space frees up instead of being dropped.
   */
  private async drainRxQueue(): Promise<void> {
    if (this.rxDrainScheduled) return;
    this.rxDrainScheduled = true;
    try {
      while (this.rxQueue.length > 0 && this._isConnected) {
        const chunk = this.rxQueue[0];
        const written = uartShared.pushRx(chunk, false);
        if (written >= chunk.length) {
          this.rxQueue.shift();
          continue;
        }
        this.rxQueue[0] = chunk.subarray(written);
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    } finally {
      this.rxDrainScheduled = false;
    }
  }

  startReadLoop(): void {
    // Reads are notification driven; just flush anything that arrived between
    // connect() and the manager starting the loops.
    void this.drainRxQueue();
  }

  stopReadLoop(): void {
    // Nothing to stop: notifications are torn down in disconnect().
  }

  startTxLoop(): void {
    if (this.txLoopRunning) return;
    this.txLoopRunning = true;
    void this.runTxLoop();
  }

  stopTxLoop(): void {
    this.txLoopRunning = false;
  }

  private async writeChunk(characteristic: BluetoothRemoteGATTCharacteristic, bytes: Uint8Array) {
    // Copy into a fresh ArrayBuffer: a view onto the shared ring buffer cannot
    // be handed to the Bluetooth stack.
    const payload = new Uint8Array(bytes);
    stats.txWrites += 1;
    stats.txBytes += payload.length;
    stats.lastTxHex = toHex(payload);
    if (stats.txWrites <= TRACE_FRAME_LIMIT) {
      console.debug(`[WebBluetooth] tx ${payload.length}: ${stats.lastTxHex}`);
    }
    if (
      characteristic.properties.writeWithoutResponse &&
      typeof characteristic.writeValueWithoutResponse === "function"
    ) {
      await characteristic.writeValueWithoutResponse(payload);
    } else if (typeof characteristic.writeValueWithResponse === "function") {
      await characteristic.writeValueWithResponse(payload);
    } else {
      await characteristic.writeValue(payload);
    }
  }

  private async runTxLoop(): Promise<void> {
    const tmp = new Uint8Array(4096);

    while (this.txLoopRunning && this._isConnected) {
      const characteristic = this.writeCharacteristic;
      if (!characteristic) break;
      const n = uartShared.popTx(tmp.length, tmp);
      if (n === 0) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        continue;
      }
      let offset = 0;
      while (offset < n && this._isConnected) {
        const size = Math.min(WRITE_CHUNK_SIZES[this.chunkSizeIndex], n - offset);
        try {
          await this.writeChunk(characteristic, tmp.subarray(offset, offset + size));
          offset += size;
        } catch (error) {
          stats.lastError = error instanceof Error ? error.message : String(error);
          if (this.chunkSizeIndex < WRITE_CHUNK_SIZES.length - 1) {
            this.chunkSizeIndex += 1;
            stats.chunkSize = WRITE_CHUNK_SIZES[this.chunkSizeIndex];
            console.warn(
              `[WebBluetooth] write of ${size} bytes failed; retrying with ${WRITE_CHUNK_SIZES[this.chunkSizeIndex]}-byte chunks`,
            );
            continue;
          }
          console.error("Web Bluetooth TX error:", error);
          this.eventHandlers.onError?.(error instanceof Error ? error : new Error(String(error)));
          this.txLoopRunning = false;
          return;
        }
      }
    }
  }

  setEventHandlers(handlers: TransportEventHandlers): void {
    this.eventHandlers = handlers;
  }

  getName(): string {
    return "Bluetooth LE";
  }

  getDescription(): string {
    return "Connect to a Proxmark5 Battery/Wireless Module or a BLE UART add-on (Nordic UART, HM-10) over Web Bluetooth";
  }
}

export default WebBluetoothTransport;
