/**
 * TransportManager - Factory and registry for transport backends
 * Manages available transports and provides unified connection interface
 */

import type { Transport, TransportType, TransportInfo, TransportDevice, TransportEventHandlers } from './types';
import { WebSerialTransport } from './WebSerialTransport';
import { TauriSerialTransport } from './TauriSerialTransport';
import { isTauri } from '../tauri';

export class TransportManager {
  private transports: Map<TransportType, Transport> = new Map();
  private activeTransport: Transport | null = null;
  private eventHandlers: TransportEventHandlers = {};

  constructor() {
    this.registerDefaultTransports();
  }

  /**
   * Register default transports based on environment
   */
  private registerDefaultTransports(): void {
    // WebSerial is available in browsers (and sometimes in Tauri webview)
    const webSerial = new WebSerialTransport();
    if (webSerial.isAvailable()) {
      this.transports.set('webserial', webSerial);
    }

    // Tauri transports - register when running in Tauri
    if (isTauri()) {
      const tauriSerial = new TauriSerialTransport();
      if (tauriSerial.isAvailable()) {
        this.transports.set('tauri-serial', tauriSerial);
      }

      // TauriBluetoothTransport will be added in Phase 4
      // const tauriBluetooth = new TauriBluetoothTransport();
      // if (tauriBluetooth.isAvailable()) {
      //   this.transports.set('tauri-bluetooth', tauriBluetooth);
      // }
    }
  }

  /**
   * Register a transport
   */
  registerTransport(transport: Transport): void {
    this.transports.set(transport.type, transport);
  }

  /**
   * Get a specific transport by type
   */
  getTransport(type: TransportType): Transport | undefined {
    return this.transports.get(type);
  }

  /**
   * Get all registered transports
   */
  getAllTransports(): Transport[] {
    return Array.from(this.transports.values());
  }

  /**
   * Get list of available transports with their info
   */
  getAvailableTransports(): TransportInfo[] {
    return Array.from(this.transports.values())
      .filter(t => t.isAvailable())
      .map(t => ({
        type: t.type,
        name: t.getName(),
        available: true,
        description: t.getDescription(),
      }));
  }

  /**
   * Get the currently active transport
   */
  getActiveTransport(): Transport | null {
    return this.activeTransport;
  }

  /**
   * Check if any transport is connected
   */
  get isConnected(): boolean {
    return this.activeTransport?.isConnected ?? false;
  }

  /**
   * Get the type of the active transport
   */
  get activeTransportType(): TransportType | null {
    return this.activeTransport?.type ?? null;
  }

  /**
   * Set event handlers that apply to all transports
   */
  setEventHandlers(handlers: TransportEventHandlers): void {
    this.eventHandlers = handlers;
    // Apply to all registered transports
    this.transports.forEach(transport => {
      transport.setEventHandlers(handlers);
    });
  }

  /**
   * Connect using a specific transport type
   */
  async connect(type: TransportType, device?: TransportDevice): Promise<boolean> {
    const transport = this.transports.get(type);
    if (!transport) {
      console.error(`Transport ${type} not registered`);
      return false;
    }

    if (!transport.isAvailable()) {
      console.error(`Transport ${type} is not available`);
      return false;
    }

    // Disconnect current transport if different
    if (this.activeTransport && this.activeTransport !== transport) {
      await this.disconnect();
    }

    // Apply current event handlers
    transport.setEventHandlers(this.eventHandlers);

    const success = await transport.connect(device);
    if (success) {
      this.activeTransport = transport;
      transport.startReadLoop();
      transport.startTxLoop();
    }

    return success;
  }

  /**
   * Disconnect the active transport
   */
  async disconnect(): Promise<void> {
    if (this.activeTransport) {
      await this.activeTransport.disconnect();
      this.activeTransport = null;
    }
  }

  /**
   * List devices for a specific transport
   */
  async listDevices(type: TransportType): Promise<TransportDevice[]> {
    const transport = this.transports.get(type);
    if (!transport || !transport.isAvailable()) {
      return [];
    }
    return transport.listDevices();
  }

  /**
   * Get the default transport type based on environment
   */
  getDefaultTransportType(): TransportType | null {
    const available = this.getAvailableTransports();
    if (available.length === 0) return null;

    // Prefer native transports in Tauri, WebSerial in browser
    if (isTauri()) {
      // Prefer Tauri serial, then Bluetooth, then WebSerial
      const priority: TransportType[] = ['tauri-serial', 'tauri-bluetooth', 'webserial'];
      for (const type of priority) {
        if (available.some(t => t.type === type)) {
          return type;
        }
      }
    }

    // Default to WebSerial in browser
    return available[0].type;
  }
}

// Singleton instance
let transportManagerInstance: TransportManager | null = null;

export function getTransportManager(): TransportManager {
  if (!transportManagerInstance) {
    transportManagerInstance = new TransportManager();
  }
  return transportManagerInstance;
}

export default TransportManager;
