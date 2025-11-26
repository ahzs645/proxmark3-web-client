import { useState, useCallback, useRef } from 'react';

// Proxmark3 vendor/product IDs
const PM3_FILTERS = [
  { usbVendorId: 0x9ac4, usbProductId: 0x4b8f }, // Proxmark3 RDV4
  { usbVendorId: 0x2d2d, usbProductId: 0x504d }, // Proxmark3 generic
];

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WebSerialState {
  status: ConnectionStatus;
  error: string | null;
  deviceInfo: {
    vendorId?: number;
    productId?: number;
  } | null;
}

export interface WebSerialActions {
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  write: (data: Uint8Array) => Promise<void>;
  read: (timeout?: number) => Promise<Uint8Array | null>;
}

export function useWebSerial(
  onData?: (data: Uint8Array) => void
): [WebSerialState, WebSerialActions] {
  const [state, setState] = useState<WebSerialState>({
    status: 'disconnected',
    error: null,
    deviceInfo: null,
  });

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const readLoopActiveRef = useRef(false);

  const startReadLoop = useCallback(async () => {
    if (!portRef.current?.readable || readLoopActiveRef.current) return;

    readLoopActiveRef.current = true;
    const reader = portRef.current.readable.getReader();
    readerRef.current = reader;

    try {
      while (readLoopActiveRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value && onData) {
          onData(value);
        }
      }
    } catch (error) {
      if (readLoopActiveRef.current) {
        console.error('Read error:', error);
      }
    } finally {
      reader.releaseLock();
      readerRef.current = null;
    }
  }, [onData]);

  const connect = useCallback(async (): Promise<boolean> => {
    if (!('serial' in navigator)) {
      setState(s => ({ ...s, status: 'error', error: 'Web Serial API not supported in this browser' }));
      return false;
    }

    try {
      setState(s => ({ ...s, status: 'connecting', error: null }));

      const port = await navigator.serial.requestPort({ filters: PM3_FILTERS });
      await port.open({ baudRate: 115200 });

      portRef.current = port;
      const info = port.getInfo();

      setState({
        status: 'connected',
        error: null,
        deviceInfo: {
          vendorId: info.usbVendorId,
          productId: info.usbProductId,
        },
      });

      // Start read loop if callback provided
      if (onData) {
        startReadLoop();
      }

      // Listen for disconnect
      port.addEventListener('disconnect', () => {
        setState({ status: 'disconnected', error: null, deviceInfo: null });
        portRef.current = null;
      });

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect';
      setState({ status: 'error', error: message, deviceInfo: null });
      return false;
    }
  }, [onData, startReadLoop]);

  const disconnect = useCallback(async () => {
    readLoopActiveRef.current = false;

    if (readerRef.current) {
      await readerRef.current.cancel();
      readerRef.current = null;
    }

    if (writerRef.current) {
      await writerRef.current.close();
      writerRef.current = null;
    }

    if (portRef.current) {
      await portRef.current.close();
      portRef.current = null;
    }

    setState({ status: 'disconnected', error: null, deviceInfo: null });
  }, []);

  const write = useCallback(async (data: Uint8Array) => {
    if (!portRef.current?.writable) {
      throw new Error('Port not connected');
    }

    const writer = portRef.current.writable.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }, []);

  const read = useCallback(async (timeout = 5000): Promise<Uint8Array | null> => {
    if (!portRef.current?.readable) {
      throw new Error('Port not connected');
    }

    const reader = portRef.current.readable.getReader();

    try {
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), timeout);
      });

      const readPromise = reader.read().then(({ value }) => value || null);

      return await Promise.race([readPromise, timeoutPromise]);
    } finally {
      reader.releaseLock();
    }
  }, []);

  return [state, { connect, disconnect, write, read }];
}

export default useWebSerial;
