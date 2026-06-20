import { classifyTagInfo } from "@/features/tag-info/helpers";
import type { TagInfo } from "@/features/tag-info/types";
import type { CardClassification, CardFamily, CardSize } from "./types";

/**
 * Turn a raw {@link TagInfo} into the normalized {@link CardClassification} the
 * rest of the workbench keys off of. Builds on the existing tag-info matching so
 * there is a single place that decides "what kind of card is this".
 */
export function classifyCard(identity: TagInfo | null): CardClassification {
  const base = classifyTagInfo(identity);

  let family: CardFamily = "unknown";
  if (base.isClassic) family = "classic";
  else if (base.isUltralight) family = "ultralight";
  else if (base.isIclass) family = "iclass";
  else if (base.isDesfire) family = "desfire";
  else if (identity?.protocol === "LF") family = "lf";

  const protocol: CardClassification["protocol"] =
    identity?.protocol ?? (family === "lf" ? "LF" : family === "unknown" ? "unknown" : "HF");

  return {
    family,
    size: base.cardSize,
    protocol,
    isClassic: base.isClassic,
    isUltralight: base.isUltralight,
    isIclass: base.isIclass,
    isDesfire: base.isDesfire,
  };
}

/** Map a detected card size onto the MIFARE attack panel's 1k/4k toggle. */
export function toAttackCardType(size: CardSize): "1k" | "4k" {
  return size === "4k" ? "4k" : "1k";
}
