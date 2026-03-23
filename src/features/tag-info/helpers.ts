import { CreditCard, Download, Key, Play, Shield } from "lucide-react";
import type { SuggestedAction, TagInfo } from "./types";

export function getCardSize(type?: string): "1k" | "4k" | "mini" | "unknown" {
  if (!type) return "unknown";
  const lower = type.toLowerCase();
  if (lower.includes("4k")) return "4k";
  if (lower.includes("1k")) return "1k";
  if (lower.includes("mini")) return "mini";
  return "unknown";
}

export function classifyTagInfo(tagInfo: TagInfo | null) {
  const type = tagInfo?.type?.toLowerCase() || "";

  return {
    isClassic:
      type.includes("mifare classic") || type.includes("mifare 1k") || type.includes("mifare 4k"),
    isUltralight: type.includes("ultralight") || type.includes("ntag"),
    isIclass: type.includes("iclass") || type.includes("picopass"),
    isDesfire: type.includes("desfire"),
    cardSize: getCardSize(tagInfo?.type),
  };
}

export function getSuggestedActions(tagInfo: TagInfo | null): SuggestedAction[] {
  if (!tagInfo?.type) return [];

  const { isClassic, isUltralight, isIclass, isDesfire, cardSize } = classifyTagInfo(tagInfo);
  const actions: SuggestedAction[] = [];

  if (isClassic) {
    const sizeFlag = cardSize === "4k" ? "--4k" : "--1k";

    actions.push({
      label: "Autopwn",
      command: `hf mf autopwn ${sizeFlag}`,
      icon: Key,
      variant: "default",
      description: `Crack all keys (${cardSize.toUpperCase()})`,
    });

    actions.push({
      label: "Dump",
      command: "hf mf dump",
      icon: Download,
      variant: "secondary",
      description: "Save card to file",
    });

    actions.push({
      label: "Simulate",
      command: "hf mf sim",
      icon: Play,
      variant: "outline",
      description: "Emulate this card",
    });

    actions.push({
      label: "Check Keys",
      command: "hf mf chk --1k",
      icon: Shield,
      variant: "outline",
      description: "Test default keys",
    });
  }

  if (isUltralight) {
    actions.push({
      label: "Dump",
      command: "hf mfu dump",
      icon: Download,
      variant: "default",
      description: "Read all pages",
    });

    actions.push({
      label: "Info",
      command: "hf mfu info",
      icon: CreditCard,
      variant: "secondary",
      description: "Detailed info",
    });

    actions.push({
      label: "Simulate",
      command: "hf mfu sim -t 7",
      icon: Play,
      variant: "outline",
      description: "Emulate card",
    });
  }

  if (isIclass) {
    actions.push({
      label: "Dump",
      command: "hf iclass dump --ki 0",
      icon: Download,
      variant: "default",
      description: "Read with default key",
    });

    actions.push({
      label: "Info",
      command: "hf iclass info",
      icon: CreditCard,
      variant: "secondary",
      description: "Card details",
    });
  }

  if (isDesfire) {
    actions.push({
      label: "Info",
      command: "hf mfdes info",
      icon: CreditCard,
      variant: "default",
      description: "Application info",
    });

    actions.push({
      label: "List Apps",
      command: "hf mfdes lsapp",
      icon: Shield,
      variant: "secondary",
      description: "List applications",
    });
  }

  return actions;
}
