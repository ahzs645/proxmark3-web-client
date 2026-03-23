import type { RefObject } from "react";
import { cn } from "@/lib/utils";
import { TERMINAL_CLASS_NAME, TERMINAL_MIN_HEIGHT } from "./config";

interface TerminalViewportProps {
  terminalRef: RefObject<HTMLDivElement | null>;
  className?: string;
  onClick: () => void;
}

export function TerminalViewport({ terminalRef, className, onClick }: TerminalViewportProps) {
  return (
    <div
      ref={terminalRef}
      className={cn(TERMINAL_CLASS_NAME, className)}
      style={{ minHeight: TERMINAL_MIN_HEIGHT }}
      onClick={onClick}
      tabIndex={0}
    />
  );
}
