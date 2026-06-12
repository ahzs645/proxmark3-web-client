import type { CardTypeConfig, MagicCardType } from "./types";

export const CARD_TYPES: Record<MagicCardType, CardTypeConfig> = {
  gen1a: {
    label: "Gen1a",
    description: "Chinese Magic Card with backdoor commands",
    color: "text-blue-600 dark:text-blue-400",
  },
  gen2: {
    label: "Gen2 (CUID)",
    description: "Direct writable Block 0, no backdoor needed",
    color: "text-green-600 dark:text-green-400",
  },
  gen3: {
    label: "Gen3 (APDU)",
    description: "Block 0 writable via APDU commands",
    color: "text-amber-600 dark:text-amber-400",
  },
  gen4: {
    label: "Gen4 (GTU)",
    description: "Ultimate magic card with password protection",
    color: "text-purple-600 dark:text-purple-400",
  },
  unknown: {
    label: "Unknown",
    description: "Card type not detected",
    color: "text-muted-foreground",
  },
};

export const SAK_PRESETS = [
  { value: "08", label: "Classic 1K" },
  { value: "18", label: "Classic 4K" },
  { value: "09", label: "Mini" },
  { value: "01", label: "Pro" },
  { value: "00", label: "Ultralight" },
  { value: "20", label: "Plus/DESFire" },
];
