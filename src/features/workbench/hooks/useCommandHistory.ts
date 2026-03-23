import { useCallback, useEffect, useState } from "react";

const COMMAND_HISTORY_KEY = "pm3-command-history";

function loadCommandHistory(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(COMMAND_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch (error) {
    console.error("Failed to parse command history", error);
    return [];
  }
}

export function useCommandHistory() {
  const [commandHistory, setCommandHistory] = useState<string[]>(() => loadCommandHistory());

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(commandHistory.slice(-100)));
    }
  }, [commandHistory]);

  const pushCommand = useCallback((command: string) => {
    setCommandHistory((prev) => [...prev.slice(-99), command]);
  }, []);

  return {
    commandHistory,
    pushCommand,
  };
}
