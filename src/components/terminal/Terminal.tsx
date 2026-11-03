import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { TerminalViewport } from "@/features/terminal/TerminalViewport";
import { TERMINAL_FONT_FAMILY, TERMINAL_THEME } from "@/features/terminal/config";
import { LineEditor } from "@/features/terminal/lineEditor";
import { createSeverityColorizer } from "@/features/terminal/severity";
import { useTerminalWriteQueue } from "@/features/terminal/queue";
import { writeTerminalWelcome } from "@/features/terminal/welcome";
import type { TerminalHandle, TerminalProps } from "@/features/terminal/types";
import { clampTerminalFontSize } from "@/features/settings/storage";
import { useAppSettings } from "@/features/settings/useAppSettings";

export type { TerminalHandle, TerminalProps } from "@/features/terminal/types";

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(
  (
    { onInput, onCommand, onInterrupt, history, passthrough = false, className, rawMode = false },
    ref,
  ) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const editorRef = useRef<LineEditor | null>(null);
    const colorizeRef = useRef(createSeverityColorizer());
    const onInputRef = useRef(onInput);
    const onCommandRef = useRef(onCommand);
    const onInterruptRef = useRef(onInterrupt);
    const historyRef = useRef(history);
    const passthroughRef = useRef(passthrough);
    const rawModeRef = useRef(rawMode);
    const { scheduleWrite, clearPendingWrites } = useTerminalWriteQueue(xtermRef);
    const fontSize = clampTerminalFontSize(useAppSettings().terminalFontSize);
    const fontSizeRef = useRef(fontSize);
    fontSizeRef.current = fontSize;

    onInputRef.current = onInput;
    onCommandRef.current = onCommand;
    onInterruptRef.current = onInterrupt;
    historyRef.current = history;
    passthroughRef.current = passthrough;
    rawModeRef.current = rawMode;

    useImperativeHandle(ref, () => ({
      write: (data: string) => {
        scheduleWrite(colorizeRef.current(data));
      },
      writeln: (data: string) => {
        scheduleWrite(colorizeRef.current(`${data}\r\n`));
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
      input: (data: string) => {
        editorRef.current?.handleData(data);
        xtermRef.current?.focus();
      },
    }));

    useEffect(() => {
      if (!terminalRef.current) return;

      const term = new XTerm({
        theme: TERMINAL_THEME,
        fontFamily: TERMINAL_FONT_FAMILY,
        fontSize: fontSizeRef.current,
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

      const editor = new LineEditor(
        {
          write: (data) => term.write(data),
          submit: (line) => {
            // While a command runs, the line is that command's stdin: sims,
            // sniffs and `hw tune` stop on Enter, and some prompts read a reply.
            if (passthroughRef.current) {
              for (const char of `${line}\n`) onInputRef.current?.(char);
              return;
            }
            const command = line.trim();
            if (command) onCommandRef.current?.(command);
            if (!rawModeRef.current) term.write("\x1b[32m[pm3]\x1b[0m ");
          },
          interrupt: () => onInterruptRef.current?.(),
          clearScreen: () => term.clear(),
          columns: () => term.cols,
          cursorColumn: () => term.buffer.active.cursorX,
          copySelection: () => {
            if (!term.hasSelection()) return false;
            void navigator.clipboard?.writeText(term.getSelection());
            term.clearSelection();
            return true;
          },
        },
        () => historyRef.current ?? [],
      );
      editorRef.current = editor;
      term.onData((data) => editor.handleData(data));

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
        editorRef.current = null;
        xtermRef.current = null;
        term.dispose();
      };
      // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Apply a font size change from Settings without recreating the terminal.
    useEffect(() => {
      const term = xtermRef.current;
      if (!term || term.options.fontSize === fontSize) return;
      term.options.fontSize = fontSize;
      try {
        fitAddonRef.current?.fit();
      } catch {
        // Ignore fit errors while the terminal is hidden
      }
    }, [fontSize]);

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
