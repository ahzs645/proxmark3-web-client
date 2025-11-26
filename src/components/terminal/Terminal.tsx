import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export interface TerminalHandle {
  write: (data: string) => void;
  writeln: (data: string) => void;
  clear: () => void;
  focus: () => void;
  sendCommand: (cmd: string) => void;
}

interface TerminalProps {
  onInput?: (data: string) => void;
  onCommand?: (cmd: string) => void;
  className?: string;
  /** When true, disables built-in prompt and passes all input to onInput */
  rawMode?: boolean;
}

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(
  ({ onInput, onCommand, className, rawMode = false }, ref) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const inputBufferRef = useRef<string>('');
    // Use refs to avoid re-initializing terminal when callbacks change
    const onInputRef = useRef(onInput);
    const onCommandRef = useRef(onCommand);
    const rawModeRef = useRef(rawMode);

    // Keep refs updated
    onInputRef.current = onInput;
    onCommandRef.current = onCommand;
    rawModeRef.current = rawMode;

    useImperativeHandle(ref, () => ({
      write: (data: string) => {
        xtermRef.current?.write(data);
      },
      writeln: (data: string) => {
        xtermRef.current?.writeln(data);
      },
      clear: () => {
        xtermRef.current?.clear();
      },
      focus: () => {
        xtermRef.current?.focus();
      },
      sendCommand: (cmd: string) => {
        if (xtermRef.current) {
          xtermRef.current.write(`\r\n[pm3] ${cmd}\r\n`);
          onCommand?.(cmd);
        }
      },
    }));

    useEffect(() => {
      if (!terminalRef.current) return;

      const term = new XTerm({
        theme: {
          background: '#0a0a0f',
          foreground: '#e4e4e7',
          cursor: '#22c55e',
          cursorAccent: '#0a0a0f',
          selectionBackground: '#22c55e40',
          black: '#27272a',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#e4e4e7',
          brightBlack: '#52525b',
          brightRed: '#f87171',
          brightGreen: '#4ade80',
          brightYellow: '#facc15',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#22d3ee',
          brightWhite: '#fafafa',
        },
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: 13,
        cursorBlink: true,
        cursorStyle: 'block',
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.open(terminalRef.current);

      // Defer fit to ensure container has dimensions
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
        } catch (e) {
          // Ignore fit errors on initial render
        }
      });

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Welcome message
      if (rawMode) {
        // WASM mode - show loading message, WASM will show its own prompt
        term.writeln('\x1b[36mLoading Proxmark3 WASM client...\x1b[0m');
        term.writeln('');
      } else {
        term.writeln('\x1b[32m╔══════════════════════════════════════════════════════════╗\x1b[0m');
        term.writeln('\x1b[32m║\x1b[0m  \x1b[1;36mProxmark3 Web Client\x1b[0m                                    \x1b[32m║\x1b[0m');
        term.writeln('\x1b[32m║\x1b[0m  Browser-based RFID research tool                        \x1b[32m║\x1b[0m');
        term.writeln('\x1b[32m╚══════════════════════════════════════════════════════════╝\x1b[0m');
        term.writeln('');
        term.writeln('\x1b[33mConnect your Proxmark3 device to get started.\x1b[0m');
        term.writeln('\x1b[90mType "help" for available commands.\x1b[0m');
        term.writeln('');
        term.write('\x1b[32m[pm3]\x1b[0m ');
      }

      // Handle input - use refs to get current values without re-initializing
      term.onKey(({ key, domEvent }) => {
        const char = key;

        if (rawModeRef.current) {
          // In raw mode, collect input locally and send on Enter
          if (domEvent.key === 'Enter') {
            term.write('\r\n');
            // Send the collected buffer as a command
            if (inputBufferRef.current.length > 0) {
              onCommandRef.current?.(inputBufferRef.current);
            }
            inputBufferRef.current = '';
          } else if (domEvent.key === 'Backspace') {
            if (inputBufferRef.current.length > 0) {
              inputBufferRef.current = inputBufferRef.current.slice(0, -1);
              term.write('\b \b');
            }
          } else if (char.length === 1 && !domEvent.ctrlKey && !domEvent.altKey) {
            inputBufferRef.current += char;
            term.write(char);
          }
          return;
        }

        // Standard mode with our own prompt
        if (domEvent.key === 'Enter') {
          const command = inputBufferRef.current.trim();
          term.write('\r\n');

          if (command) {
            onCommandRef.current?.(command);
          }

          inputBufferRef.current = '';
          term.write('\x1b[32m[pm3]\x1b[0m ');
        } else if (domEvent.key === 'Backspace') {
          if (inputBufferRef.current.length > 0) {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1);
            term.write('\b \b');
          }
        } else if (char.length === 1 && !domEvent.ctrlKey && !domEvent.altKey) {
          inputBufferRef.current += char;
          term.write(char);
          onInputRef.current?.(char);
        }
      });

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        try {
          if (terminalRef.current && terminalRef.current.offsetWidth > 0) {
            fitAddon.fit();
          }
        } catch (e) {
          // Ignore fit errors during resize
        }
      });
      resizeObserver.observe(terminalRef.current);

      // Auto-focus terminal
      setTimeout(() => term.focus(), 100);

      return () => {
        resizeObserver.disconnect();
        term.dispose();
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only initialize once - callbacks accessed via refs

    return (
      <div
        ref={terminalRef}
        className={`terminal-container bg-[#0a0a0f] rounded-lg overflow-hidden ${className || ''}`}
        style={{ minHeight: '300px' }}
        onClick={() => xtermRef.current?.focus()}
        tabIndex={0}
      />
    );
  }
);

Terminal.displayName = 'Terminal';

export default Terminal;
