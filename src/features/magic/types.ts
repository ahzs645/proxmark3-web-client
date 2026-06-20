export type MagicCardType = "gen1a" | "gen2" | "gen3" | "gen4" | "unknown";
export type KeyType = "A" | "B";

export interface MagicCardPanelProps {
  onCommand: (cmd: string) => void;
  disabled?: boolean;
}

export interface CardTypeConfig {
  label: string;
  description: string;
  color: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}
