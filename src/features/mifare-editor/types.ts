import type { AccessBitsResult, AccessPresetKey, Permission } from "@/lib/accessBits";

export type KeyType = "A" | "B";

export interface BlockRow {
  sector: number;
  block: number;
  data: string;
  dirty?: boolean;
}

export interface TrailerPreset {
  label: string;
  keyA: string;
  keyB: string;
  access: string;
  gpb: string;
}

export interface PermissionBadgeVariant {
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ReactNode;
}

export interface TrailerDecoderState {
  accessBitsHex: string;
  keyA: string;
  keyB: string;
  gpb: string;
  c0: number;
  c1: number;
  c2: number;
  c3: number;
  decoded: AccessBitsResult;
  fullTrailer: string;
  keyBReadable: boolean;
  handleCValueChange: (index: number, value: number) => void;
  handleAccessBitsChange: (value: string) => void;
  handleKeyAChange: (value: string) => void;
  handleKeyBChange: (value: string) => void;
  handleGpbChange: (value: string) => void;
  handlePresetClick: (presetKey: AccessPresetKey) => void;
  copyToClipboard: (text: string) => void;
}

export type { AccessPresetKey, Permission };
