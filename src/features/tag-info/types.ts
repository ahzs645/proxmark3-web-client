import type { LucideIcon } from "lucide-react";

export interface TagInfo {
  uid?: string;
  type?: string;
  sak?: string;
  atqa?: string;
  ats?: string;
  manufacturer?: string;
  size?: string;
  protocol?: "HF" | "LF";
  subtype?: string;
}

export interface TagInfoPanelProps {
  tagInfo: TagInfo | null;
  onRefresh?: () => void;
  onCopyUid?: () => void;
  onCommand?: (cmd: string) => void;
  disabled?: boolean;
}

export interface SuggestedAction {
  label: string;
  command: string;
  icon: LucideIcon;
  variant?: "default" | "secondary" | "outline";
  description?: string;
}
