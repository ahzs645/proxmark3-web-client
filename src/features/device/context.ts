import { createContext, useContext } from "react";
import type { DeviceProfileContextValue } from "./types";

export const DeviceProfileContext = createContext<DeviceProfileContextValue | null>(null);

export function useDeviceProfile(): DeviceProfileContextValue {
  const context = useContext(DeviceProfileContext);
  if (!context) throw new Error("useDeviceProfile must be used within DeviceProfileContext");
  return context;
}
