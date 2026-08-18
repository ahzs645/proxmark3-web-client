/**
 * Transport abstraction layer for Proxmark3 communication
 * Supports multiple backends: WebSerial (browser), native serial (Tauri), Bluetooth SPP (Tauri)
 */

export type TransportType = "webserial" | "tauri-serial" | "tauri-bluetooth";

export interface TransportDevice {
  /** Unique identifier for this device */
  id: string;
  /** Human-readable device name */
  name: string;
  /** Transport type this device belongs to */
  type: TransportType;
  /** Address/path (port path for serial, MAC address for Bluetooth) */
  address?: string;
}

export interface TransportInfo {
  type: TransportType;
  name: string;
  available: boolean;
  description: string;
}

export interface TransportEventHandlers {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onData?: (data: Uint8Array) => void;
}

/**
 * Transport interface - all transport implementations must implement this
 */
export interface Transport {
  /** Transport type identifier */
  readonly type: TransportType;

  /** Current connection state */
  readonly isConnected: boolean;

  /**
   * Check if this transport is available in the current environment
   * (e.g., WebSerial requires browser support, Tauri transports require Tauri runtime)
   */
  isAvailable(): boolean;

  /**
   * List available devices for this transport
   * For WebSerial: triggers browser device picker
   * For Tauri serial: lists COM ports
   * For Tauri Bluetooth: scans for paired/nearby devices
   */
  listDevices(): Promise<TransportDevice[]>;

  /**
   * Connect to a device
   * @param device - Optional device to connect to. If not provided, may trigger a picker.
   * @returns true if connection successful
   */
  connect(device?: TransportDevice): Promise<boolean>;

  /**
   * Disconnect from current device
   */
  disconnect(): Promise<void>;

  /**
   * Start the read loop - reads from device and pushes to UartShared.pushRx
   */
  startReadLoop(): void;

  /**
   * Stop the read loop
   */
  stopReadLoop(): void;

  /**
   * Start the TX loop - pops from UartShared.popTx and writes to device
   */
  startTxLoop(): void;

  /**
   * Stop the TX loop
   */
  stopTxLoop(): void;

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: TransportEventHandlers): void;

  /**
   * Get human-readable name for this transport
   */
  getName(): string;

  /**
   * Get description for this transport
   */
  getDescription(): string;
}

/**
 * Configuration for transport connection
 */
export interface TransportConfig {
  /** Baud rate for serial connections (default: 115200) */
  baudRate?: number;
  /** Data bits (default: 8) */
  dataBits?: 7 | 8;
  /** Stop bits (default: 1) */
  stopBits?: 1 | 2;
  /** Parity (default: none) */
  parity?: "none" | "even" | "odd";
  /** Flow control (default: none) */
  flowControl?: "none" | "hardware";
}

export const DEFAULT_TRANSPORT_CONFIG: TransportConfig = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: "none",
  flowControl: "none",
};
