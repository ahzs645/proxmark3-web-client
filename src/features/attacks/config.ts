import { Key, Lock, Search, Target, Unlock, Zap } from "lucide-react";
import type { AttackConfig, AttackType, QuickAttack } from "./types";

export const ATTACK_CONFIGS: Record<AttackType, AttackConfig> = {
  autopwn: {
    label: "Autopwn",
    description: "Automatic key recovery using all available attacks",
    icon: Zap,
    requiresKnownKey: false,
    requiresTargetBlock: false,
    command: (p) => `hf mf autopwn --${p.cardType}${p.keyFile ? ` -f ${p.keyFile}` : ""}`,
  },
  nested: {
    label: "Nested",
    description: "Recover keys using a known key (fast, requires one known key)",
    icon: Key,
    requiresKnownKey: true,
    requiresTargetBlock: false,
    command: (p) =>
      `hf mf nested --${p.cardType} --blk ${p.knownBlock} -${p.knownKeyType.toLowerCase()} -k ${p.knownKey}`,
  },
  staticnested: {
    label: "Static Nested",
    description: "For cards with static encrypted nonce (some Chinese clones)",
    icon: Lock,
    requiresKnownKey: true,
    requiresTargetBlock: false,
    command: (p) =>
      `hf mf staticnested --${p.cardType} --blk ${p.knownBlock} -${p.knownKeyType.toLowerCase()} -k ${p.knownKey}`,
  },
  darkside: {
    label: "Darkside",
    description: "Recover first key with no prior knowledge (slow, ~5-30 min)",
    icon: Unlock,
    requiresKnownKey: false,
    requiresTargetBlock: false,
    command: () => "hf mf darkside",
  },
  hardnested: {
    label: "Hardnested",
    description: "Recover specific key using known key (works on hardened cards)",
    icon: Target,
    requiresKnownKey: true,
    requiresTargetBlock: true,
    command: (p) =>
      `hf mf hardnested --blk ${p.knownBlock} -${p.knownKeyType.toLowerCase()} -k ${p.knownKey} --tblk ${p.targetBlock} --t${p.targetKeyType.toLowerCase()}${p.slow ? " -s" : ""}`,
  },
  chk: {
    label: "Check Keys",
    description: "Test a list of known keys against all sectors",
    icon: Search,
    requiresKnownKey: false,
    requiresTargetBlock: false,
    command: (p) => `hf mf chk --${p.cardType}${p.keyFile ? ` -f ${p.keyFile}` : ""}`,
  },
};

export const QUICK_ATTACKS: QuickAttack[] = [
  { label: "Autopwn 1K", command: "hf mf autopwn --1k", variant: "default" },
  { label: "Autopwn 4K", command: "hf mf autopwn --4k", variant: "secondary" },
  { label: "Darkside", command: "hf mf darkside", variant: "outline" },
  { label: "Check Default Keys", command: "hf mf chk --1k", variant: "outline" },
];

export const DEFAULT_KEYS = [
  "FFFFFFFFFFFF",
  "A0A1A2A3A4A5",
  "D3F7D3F7D3F7",
  "000000000000",
  "B0B1B2B3B4B5",
  "4D3A99C351DD",
  "1A982C7E459A",
  "AABBCCDDEEFF",
];

export const ATTACK_ENTRIES = Object.entries(ATTACK_CONFIGS) as [AttackType, AttackConfig][];
