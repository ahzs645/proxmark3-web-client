import { createContext, useContext } from "react";
import type { CommandCenter } from "./types";

export const CommandCenterContext = createContext<CommandCenter | null>(null);

/**
 * Read the session's command state. Available to every panel routed by the
 * workbench, so a panel can reflect "something is running" without the shell
 * having to thread a `busy` prop through it.
 */
export function useCommands(): CommandCenter {
  const ctx = useContext(CommandCenterContext);
  if (!ctx) {
    throw new Error("useCommands must be used within a CommandCenterContext provider");
  }
  return ctx;
}
