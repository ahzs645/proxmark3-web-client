import { createContext, useContext } from "react";
import type { CardTargetContextValue } from "./types";

export const CardTargetContext = createContext<CardTargetContextValue | null>(null);

/**
 * Read the active card target. Must be called inside the provider rendered by
 * App.tsx; every panel routed by MainPanelRouter is.
 */
export function useTarget(): CardTargetContextValue {
  const ctx = useContext(CardTargetContext);
  if (!ctx) {
    throw new Error("useTarget must be used within a CardTargetContext provider");
  }
  return ctx;
}
