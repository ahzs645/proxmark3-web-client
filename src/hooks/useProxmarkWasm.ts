import { useEffect, useMemo, useRef, useState } from "react";
import { getTransportManager } from "../lib/transports";
import type { TransportType } from "../lib/transports";
import { useBufferedOutput } from "./proxmark-wasm/outputBuffer";
import { ensureWasmRuntimeLoaded } from "./proxmark-wasm/runtimeLoader";
import { getWasmLoaded } from "./proxmark-wasm/runtimeState";
import type { UseProxmarkWasmOptions, UseProxmarkWasmReturn } from "./proxmark-wasm/types";
import { usePm3CommandChannel } from "./proxmark-wasm/usePm3CommandChannel";

export function useProxmarkWasm({
  onOutput,
  onReady,
  onError,
}: UseProxmarkWasmOptions): UseProxmarkWasmReturn {
  const initialLoaded = getWasmLoaded();
  const [isLoading, setIsLoading] = useState(!initialLoaded);
  const [isReady, setIsReady] = useState(initialLoaded);
  const [isDeviceConnected, setIsDeviceConnected] = useState(false);
  const [activeTransportType, setActiveTransportType] = useState<TransportType | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const onOutputRef = useRef(onOutput);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const isReadyRef = useRef(initialLoaded);

  const transportManager = useMemo(() => getTransportManager(), []);
  const availableTransports = useMemo(
    () => transportManager.getAvailableTransports(),
    [transportManager],
  );

  useEffect(() => {
    onOutputRef.current = onOutput;
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
    isReadyRef.current = isReady;
  }, [isReady, onOutput, onReady, onError]);

  const { flushOutput, outputBufferRef, scheduleOutputFlush } = useBufferedOutput(onOutputRef);

  useEffect(() => {
    ensureWasmRuntimeLoaded({
      flushOutput,
      onErrorRef,
      onReadyRef,
      outputBufferRef,
      scheduleOutputFlush,
      setError,
      setIsLoading,
      setIsReady,
    });
  }, [flushOutput, onErrorRef, onReadyRef, outputBufferRef, scheduleOutputFlush]);

  const { connectDevice, disconnectDevice, hardReset, sendBreak, sendCommand, sendInput } =
    usePm3CommandChannel({
      isReady,
      isReadyRef,
      onErrorRef,
      setActiveTransportType,
      setIsDeviceConnected,
      transportManager,
    });

  return {
    isLoading,
    isReady,
    isDeviceConnected,
    error,
    sendCommand,
    sendInput,
    sendBreak,
    hardReset,
    connectDevice,
    disconnectDevice,
    availableTransports,
    activeTransportType,
  };
}

export default useProxmarkWasm;
