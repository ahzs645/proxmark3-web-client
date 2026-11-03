export interface TerminalHandle {
  write: (data: string) => void;
  writeln: (data: string) => void;
  clear: () => void;
  focus: () => void;
  sendCommand: (cmd: string) => void;
  /** Feeds keys to the line editor as if typed (the touch key bar uses this). */
  input: (data: string) => void;
}

export interface TerminalProps {
  onInput?: (data: string) => void;
  onCommand?: (cmd: string) => void;
  /** Ctrl+C on an empty line. */
  onInterrupt?: () => void;
  /** Earlier commands, oldest first, for Up/Down recall. */
  history?: readonly string[];
  /**
   * A command is running: Enter sends the typed line to its stdin through
   * `onInput` instead of starting a new command.
   */
  passthrough?: boolean;
  className?: string;
  /** When true, the client prints the prompt; otherwise the terminal writes its own. */
  rawMode?: boolean;
}
