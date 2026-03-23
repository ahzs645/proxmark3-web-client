export type Protocol = "14a" | "14b" | "15" | "iclass" | "lf";

export interface CapturedFrame {
  id: string;
  timestamp: number;
  direction: "reader" | "tag";
  data: string;
  crc?: string;
  crcValid?: boolean;
  command?: string;
  annotation?: string;
}

export interface TrafficCapturePanelProps {
  onCommand: (cmd: string) => void;
  disabled?: boolean;
}

export interface ProtocolConfig {
  label: string;
  sniffCmd: string;
  listCmd: string;
}
