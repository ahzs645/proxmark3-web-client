import type { RefObject } from "react";
import { cn } from "@/lib/utils";
import { TERMINAL_CLASS_NAME } from "./config";

interface TerminalViewportProps {
  terminalRef: RefObject<HTMLDivElement | null>;
  className?: string;
  onClick: () => void;
}

export function TerminalViewport({ terminalRef, className, onClick }: TerminalViewportProps) {
  return (
    <div
      ref={terminalRef}
      className={cn(TERMINAL_CLASS_NAME, "min-h-0", className)}
      onClick={onClick}
      tabIndex={0}
    />
  );
}
