export interface TerminalHandle {
  write: (data: string) => void;
  writeln: (data: string) => void;
  clear: () => void;
  focus: () => void;
  sendCommand: (cmd: string) => void;
}

export interface TerminalProps {
  onInput?: (data: string) => void;
  onCommand?: (cmd: string) => void;
  className?: string;
  /** When true, disables built-in prompt and passes all input to onInput */
  rawMode?: boolean;
}
