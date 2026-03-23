import type { LucideIcon } from "lucide-react";

export type CardType = "1k" | "4k";
export type KeyType = "A" | "B";
export type AttackType = "autopwn" | "nested" | "staticnested" | "darkside" | "hardnested" | "chk";

export interface AttackParams {
  cardType: CardType;
  knownBlock: string;
  knownKeyType: KeyType;
  knownKey: string;
  targetBlock: string;
  targetKeyType: KeyType;
  keyFile?: string;
  slow?: boolean;
}

export interface AttackConfig {
  label: string;
  description: string;
  icon: LucideIcon;
  requiresKnownKey: boolean;
  requiresTargetBlock: boolean;
  command: (params: AttackParams) => string;
}

export interface QuickAttack {
  label: string;
  command: string;
  variant: "default" | "secondary" | "outline";
}
