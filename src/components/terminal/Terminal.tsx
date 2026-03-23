import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { TerminalViewport } from "@/features/terminal/TerminalViewport";
import {
  TERMINAL_FONT_FAMILY,
  TERMINAL_FONT_SIZE,
  TERMINAL_THEME,
} from "@/features/terminal/config";
import { handleTerminalKey } from "@/features/terminal/keyboard";
import { useTerminalWriteQueue } from "@/features/terminal/queue";
import { writeTerminalWelcome } from "@/features/terminal/welcome";
import type { TerminalHandle, TerminalProps } from "@/features/terminal/types";

export type { TerminalHandle, TerminalProps } from "@/features/terminal/types";

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(
  ({ onInput, onCommand, className, rawMode = false }, ref) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const inputBufferRef = useRef("");
    const onInputRef = useRef(onInput);
    const onCommandRef = useRef(onCommand);
    const rawModeRef = useRef(rawMode);
    const { scheduleWrite, clearPendingWrites } = useTerminalWriteQueue(xtermRef);

    onInputRef.current = onInput;
    onCommandRef.current = onCommand;
    rawModeRef.current = rawMode;

    useImperativeHandle(ref, () => ({
      write: (data: string) => {
        scheduleWrite(data);
      },
      writeln: (data: string) => {
        scheduleWrite(`${data}\r\n`);
      },
      clear: () => {
        clearPendingWrites();
        xtermRef.current?.clear();
      },
      focus: () => {
        xtermRef.current?.focus();
      },
      sendCommand: (cmd: string) => {
        if (xtermRef.current) {
          scheduleWrite(`\r\n[pm3] ${cmd}\r\n`);
          onCommand?.(cmd);
        }
      },
    }));

    useEffect(() => {
      if (!terminalRef.current) return;

      const term = new XTerm({
        theme: TERMINAL_THEME,
        fontFamily: TERMINAL_FONT_FAMILY,
        fontSize: TERMINAL_FONT_SIZE,
        cursorBlink: true,
        cursorStyle: "block",
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);

      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
        } catch {
          // Ignore fit errors on initial render
        }
      });

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      writeTerminalWelcome(term, rawMode);

      term.onKey((event) => {
        handleTerminalKey(
          {
            term,
            inputBufferRef,
            rawModeRef,
            onInputRef,
            onCommandRef,
          },
          event,
        );
      });

      const resizeObserver = new ResizeObserver(() => {
        try {
          if (terminalRef.current && terminalRef.current.offsetWidth > 0) {
            fitAddon.fit();
          }
        } catch {
          // Ignore fit errors during resize
        }
      });
      resizeObserver.observe(terminalRef.current);

      setTimeout(() => term.focus(), 100);

      return () => {
        clearPendingWrites();
        resizeObserver.disconnect();
        fitAddonRef.current = null;
        xtermRef.current = null;
        term.dispose();
      };
      // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <TerminalViewport
        terminalRef={terminalRef}
        className={className}
        onClick={() => xtermRef.current?.focus()}
      />
    );
  },
);

Terminal.displayName = "Terminal";

export default Terminal;
