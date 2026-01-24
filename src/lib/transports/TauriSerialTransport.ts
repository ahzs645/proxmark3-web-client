/**
 * Tauri Serial Transport - Native serial port communication via Rust backend
 * Uses Tauri commands to communicate with the serialport Rust crate
 */

import { uartShared } from '../pm3WebUSB';
import { isTauri, invoke } from '../tauri';
import type { Transport, TransportType, TransportDevice, TransportEventHandlers } from './types';

interface PortInfo {
  name: string;
  port_type: string;
  vid: number | null;
  pid: number | null;
  serial_number: string | null;
  manufacturer: string | null;
  product: string | null;
}

export class TauriSerialTransport implements Transport {
  readonly type: TransportType = 'tauri-serial';

  private _isConnected: boolean = false;
  private readLoopRunning: boolean = false;
  private txLoopRunning: boolean = false;
  private eventHandlers: TransportEventHandlers = {};
  private connectedPortName: string | null = null;

  get isConnected(): boolean {
    return this._isConnected;
  }

  isAvailable(): boolean {
    return isTauri();
  }

  async listDevices(): Promise<TransportDevice[]> {
    if (!this.isAvailable()) return [];

    try {
      const ports = await invoke<PortInfo[]>('serial_list_ports');
      return ports.map(port => ({
        id: port.name,
        name: this.formatPortName(port),
        type: this.type,
        address: port.name,
      }));
    } catch (error) {
      console.error('Failed to list serial ports:', error);
      return [];
    }
  }

  private formatPortName(port: PortInfo): string {
    const parts = [port.name];
    if (port.product) {
      parts.push(`(${port.product})`);
    } else if (port.manufacturer) {
      parts.push(`(${port.manufacturer})`);
    }
    return parts.join(' ');
  }

  async connect(device?: TransportDevice): Promise<boolean> {
    if (!this.isAvailable()) {
      console.error('Tauri serial not available');
      return false;
    }

    try {
      let portName: string;

      if (device) {
        portName = device.address || device.id;
      } else {
        // Auto-detect: try to find a Proxmark3 device
        const devices = await this.listDevices();
        const pm3Device = devices.find(d =>
          d.name.toLowerCase().includes('proxmark') ||
          d.name.toLowerCase().includes('pm3')
        );

        if (pm3Device) {
          portName = pm3Device.address || pm3Device.id;
        } else if (devices.length > 0) {
          // Fall back to first available device
          portName = devices[0].address || devices[0].id;
        } else {
          throw new Error('No serial ports available');
        }
      }

      const success = await invoke<boolean>('serial_connect', {
        portName,
        baudRate: 115200,
      });

      if (success) {
        this._isConnected = true;
        this.connectedPortName = portName;

        // Initialize shared memory if WASM runtime is ready
        if (window.Module && window.Module.HEAPU8 && window.Module._pm3_uart_rx_head_ptr) {
          uartShared.init(window.Module);
        }

        this.eventHandlers.onConnect?.();
      }

      return success;
    } catch (error) {
      console.error('Tauri serial connection failed:', error);
      this.eventHandlers.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.stopReadLoop();
    this.stopTxLoop();

    try {
      await invoke('serial_disconnect');
    } catch (error) {
      console.error('Error disconnecting:', error);
    }

    this._isConnected = false;
    this.connectedPortName = null;
    this.eventHandlers.onDisconnect?.();
  }

  startReadLoop(): void {
    if (this.readLoopRunning) return;
    this.readLoopRunning = true;
    this.runReadLoop();
  }

  stopReadLoop(): void {
    this.readLoopRunning = false;
  }

  private async runReadLoop(): Promise<void> {
    while (this.readLoopRunning && this._isConnected) {
      try {
        const data = await invoke<number[]>('serial_read', { maxBytes: 4096 });
        if (data && data.length > 0) {
          const uint8Data = new Uint8Array(data);
          uartShared.pushRx(uint8Data);
          this.eventHandlers.onData?.(uint8Data);
        }
      } catch (error) {
        // Check if still connected
        try {
          const connected = await invoke<boolean>('serial_is_connected');
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
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }

  startTxLoop(): void {
    if (this.txLoopRunning) return;
    this.txLoopRunning = true;
    this.runTxLoop();
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
          await invoke('serial_write', { data: dataToSend });
        } else {
          // Sleep a bit to avoid busy-looping
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      } catch (error) {
        console.error('Tauri serial TX error:', error);
        this.eventHandlers.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  setEventHandlers(handlers: TransportEventHandlers): void {
    this.eventHandlers = handlers;
  }

  getName(): string {
    return 'Native Serial (USB)';
  }

  getDescription(): string {
    return 'Connect via USB using native serial port (Tauri)';
  }
}

export default TauriSerialTransport;
