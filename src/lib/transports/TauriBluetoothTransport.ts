/**
 * Tauri Bluetooth SPP Transport - Bluetooth Serial Port Profile communication
 * Uses Tauri commands to communicate via IOBluetooth on macOS
 *
 * Proxmark3 X Bluetooth specs:
 * - Device Name: "Proxmark3 X"
 * - Protocol: SPP 3.0 (Classic Bluetooth)
 * - PIN: 1234
 */

import { uartShared } from "../pm3WebUSB";
import { isTauri, invoke } from "../tauri";
import type { Transport, TransportType, TransportDevice, TransportEventHandlers } from "./types";

interface BluetoothDeviceInfo {
  address: string;
  name: string;
  paired: boolean;
  connected: boolean;
}

export class TauriBluetoothTransport implements Transport {
  readonly type: TransportType = "tauri-bluetooth";

  private _isConnected: boolean = false;
  private readLoopRunning: boolean = false;
  private txLoopRunning: boolean = false;
  private eventHandlers: TransportEventHandlers = {};

  // Proxmark3 X default PIN
  private static readonly PM3_PIN = "1234";

  get isConnected(): boolean {
    return this._isConnected;
  }

  isAvailable(): boolean {
    return isTauri();
  }

  async listDevices(): Promise<TransportDevice[]> {
    if (!this.isAvailable()) return [];

    try {
      const devices = await invoke<BluetoothDeviceInfo[]>("bt_list_devices");
      return devices.map((device) => ({
        id: device.address,
        name: `${device.name} ${device.paired ? "(Paired)" : ""} ${device.connected ? "[Connected]" : ""}`,
        type: this.type,
        address: device.address,
      }));
    } catch (error) {
      console.error("Failed to list Bluetooth devices:", error);
      return [];
    }
  }

  async scanDevices(): Promise<TransportDevice[]> {
    if (!this.isAvailable()) return [];

    try {
      const devices = await invoke<BluetoothDeviceInfo[]>("bt_scan_devices");
      return devices.map((device) => ({
        id: device.address,
        name: `${device.name} ${device.paired ? "(Paired)" : ""} ${device.connected ? "[Connected]" : ""}`,
        type: this.type,
        address: device.address,
      }));
    } catch (error) {
      console.error("Failed to scan Bluetooth devices:", error);
      return [];
    }
  }

  async connect(device?: TransportDevice): Promise<boolean> {
    if (!this.isAvailable()) {
      console.error("Tauri Bluetooth not available");
      return false;
    }

    try {
      let address: string;

      if (device) {
        address = device.address || device.id;
      } else {
        // Auto-detect: try to find a Proxmark3 device
        const devices = await this.scanDevices();
        const pm3Device = devices.find(
          (d) => d.name.toLowerCase().includes("proxmark") || d.name.toLowerCase().includes("pm3"),
        );

        if (pm3Device) {
          address = pm3Device.address || pm3Device.id;
        } else if (devices.length > 0) {
          // Fall back to first available device
          address = devices[0].address || devices[0].id;
        } else {
          throw new Error("No Bluetooth devices available. Please pair Proxmark3 X first.");
        }
      }

      console.log(`Connecting to Bluetooth device: ${address}`);

      const success = await invoke<boolean>("bt_connect", {
        address,
        pin: TauriBluetoothTransport.PM3_PIN,
      });

      if (success) {
        this._isConnected = true;
        // this._connectedAddress = address;

        // Initialize shared memory if WASM runtime is ready
        if (window.Module && window.Module.HEAPU8 && window.Module._pm3_uart_rx_head_ptr) {
          uartShared.init(window.Module);
        }

        this.eventHandlers.onConnect?.();
      }

      return success;
    } catch (error) {
      console.error("Bluetooth connection failed:", error);
      this.eventHandlers.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.stopReadLoop();
    this.stopTxLoop();

    try {
      await invoke("bt_disconnect");
    } catch (error) {
      console.error("Error disconnecting Bluetooth:", error);
    }

    this._isConnected = false;
    // this._connectedAddress = null;
    this.eventHandlers.onDisconnect?.();
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
        const data = await invoke<number[]>("bt_read", { maxBytes: 4096 });
        if (data && data.length > 0) {
          const uint8Data = new Uint8Array(data);
          uartShared.pushRx(uint8Data);
          this.eventHandlers.onData?.(uint8Data);
        }
      } catch {
        // Check if still connected
        try {
          const connected = await invoke<boolean>("bt_is_connected");
          if (!connected) {
            this._isConnected = false;
            this.readLoopRunning = false;
            this.eventHandlers.onDisconnect?.();
            break;
          }
        } catch {
          // Ignore connection check errors
        }
      }

      // Small delay to prevent busy-looping
      await new Promise((resolve) => setTimeout(resolve, 10));
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
          const dataToSend = Array.from(tmp.subarray(0, n));
          await invoke("bt_write", { data: dataToSend });
        } else {
          // Sleep a bit to avoid busy-looping
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      } catch (error) {
        console.error("Bluetooth TX error:", error);
        this.eventHandlers.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  setEventHandlers(handlers: TransportEventHandlers): void {
    this.eventHandlers = handlers;
  }

  getName(): string {
    return "Bluetooth (SPP)";
  }

  getDescription(): string {
    return "Connect via Bluetooth Serial Port Profile (Proxmark3 X)";
  }
}

export default TauriBluetoothTransport;
