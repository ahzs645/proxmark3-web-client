import type { MutableRefObject } from "react";
import type { Terminal as XTerm } from "@xterm/xterm";
import type { TerminalProps } from "./types";

interface TerminalKeyEvent {
  key: string;
  domEvent: KeyboardEvent;
}

interface TerminalKeyHandlerDeps {
  term: XTerm;
  inputBufferRef: MutableRefObject<string>;
  rawModeRef: MutableRefObject<boolean>;
  onInputRef: MutableRefObject<TerminalProps["onInput"]>;
  onCommandRef: MutableRefObject<TerminalProps["onCommand"]>;
}

export function handleTerminalKey(
  deps: TerminalKeyHandlerDeps,
  { key, domEvent }: TerminalKeyEvent,
) {
  const char = key;

  if (deps.rawModeRef.current) {
    if (domEvent.key === "Enter") {
      deps.term.write("\r\n");
      if (deps.inputBufferRef.current.length > 0) {
        deps.onCommandRef.current?.(deps.inputBufferRef.current);
      }
      deps.inputBufferRef.current = "";
    } else if (domEvent.key === "Backspace") {
      if (deps.inputBufferRef.current.length > 0) {
        deps.inputBufferRef.current = deps.inputBufferRef.current.slice(0, -1);
        deps.term.write("\b \b");
      }
    } else if (char.length === 1 && !domEvent.ctrlKey && !domEvent.altKey) {
      deps.inputBufferRef.current += char;
      deps.term.write(char);
    }
    return;
  }

  if (domEvent.key === "Enter") {
    const command = deps.inputBufferRef.current.trim();
    deps.term.write("\r\n");

    if (command) {
      deps.onCommandRef.current?.(command);
    }

    deps.inputBufferRef.current = "";
    deps.term.write("\x1b[32m[pm3]\x1b[0m ");
  } else if (domEvent.key === "Backspace") {
    if (deps.inputBufferRef.current.length > 0) {
      deps.inputBufferRef.current = deps.inputBufferRef.current.slice(0, -1);
      deps.term.write("\b \b");
    }
  } else if (char.length === 1 && !domEvent.ctrlKey && !domEvent.altKey) {
    deps.inputBufferRef.current += char;
    deps.term.write(char);
    deps.onInputRef.current?.(char);
  }
}
