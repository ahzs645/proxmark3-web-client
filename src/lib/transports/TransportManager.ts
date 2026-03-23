/**
 * TransportManager - Factory and registry for transport backends
 * Manages available transports and provides unified connection interface
 */

import type {
  Transport,
  TransportType,
  TransportInfo,
  TransportDevice,
  TransportEventHandlers,
} from "./types";
import {
  connectTransport,
  createTransportManagerState,
  disconnectActiveTransport,
  getActiveTransport,
  getActiveTransportType,
  getAllTransports,
  getAvailableTransports,
  getDefaultTransportType,
  getTransport,
  isConnected,
  listDevicesForTransport,
  registerDefaultTransports,
  registerTransport,
  setEventHandlers,
} from "./manager";

export class TransportManager {
  private readonly state = createTransportManagerState();

  constructor() {
    registerDefaultTransports(this.state);
  }

  /**
   * Register a transport
   */
  registerTransport(transport: Transport): void {
    registerTransport(this.state, transport);
  }

  /**
   * Get a specific transport by type
   */
  getTransport(type: TransportType): Transport | undefined {
    return getTransport(this.state, type);
  }

  /**
   * Get all registered transports
   */
  getAllTransports(): Transport[] {
    return getAllTransports(this.state);
  }

  /**
   * Get list of available transports with their info
   */
  getAvailableTransports(): TransportInfo[] {
    return getAvailableTransports(this.state);
  }

  /**
   * Get the currently active transport
   */
  getActiveTransport(): Transport | null {
    return getActiveTransport(this.state);
  }

  /**
   * Check if any transport is connected
   */
  get isConnected(): boolean {
    return isConnected(this.state);
  }

  /**
   * Get the type of the active transport
   */
  get activeTransportType(): TransportType | null {
    return getActiveTransportType(this.state);
  }

  /**
   * Set event handlers that apply to all transports
   */
  setEventHandlers(handlers: TransportEventHandlers): void {
    setEventHandlers(this.state, handlers);
  }

  /**
   * Connect using a specific transport type
   */
  async connect(type: TransportType, device?: TransportDevice): Promise<boolean> {
    return connectTransport(this.state, type, device);
  }

  /**
   * Disconnect the active transport
   */
  async disconnect(): Promise<void> {
    await disconnectActiveTransport(this.state);
  }

  /**
   * List devices for a specific transport
   */
  async listDevices(type: TransportType): Promise<TransportDevice[]> {
    return listDevicesForTransport(this.state, type);
  }

  /**
   * Get the default transport type based on environment
   */
  getDefaultTransportType(): TransportType | null {
    return getDefaultTransportType(this.state);
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
