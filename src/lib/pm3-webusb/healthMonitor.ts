import { getPm3Module, hasPendingTx } from "./moduleAccess";

interface HealthMonitorOptions {
  isConnected: () => boolean;
  getLastRxTime: () => number;
  getLastTxTime: () => number;
  onUnresponsive?: () => void;
}

export function startHealthMonitor({
  isConnected,
  getLastRxTime,
  getLastTxTime,
  onUnresponsive,
}: HealthMonitorOptions): ReturnType<typeof setInterval> {
  return setInterval(() => {
    if (!isConnected()) return;

    const now = Date.now();
    const timeSinceRx = now - getLastRxTime();
    const timeSinceTx = now - getLastTxTime();

    if (timeSinceRx > 10000 && timeSinceTx < 10000) {
      const module = getPm3Module();
      const pendingTx = hasPendingTx(module);

      if (pendingTx === false) {
        console.warn("[PM3] No response from device for 10+ seconds - device may be unresponsive");
        onUnresponsive?.();
      }
    }
  }, 5000);
}
