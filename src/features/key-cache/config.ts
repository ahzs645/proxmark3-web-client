import { FileText, HardDrive, KeyRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { BadgeProps } from "@/components/ui/badge";
import type { CachedAssetKind } from "./types";

export const kindConfig: Record<
  CachedAssetKind,
  {
    label: string;
    variant: BadgeProps["variant"];
    icon: LucideIcon;
    commandTemplates: string[];
  }
> = {
  keys: {
    label: "Keys",
    variant: "success",
    icon: KeyRound,
    commandTemplates: [
      "mem load -f {{path}} --mfc",
      "hf mf autopwn --1k -f {{path}}",
      "hf iclass managekeys --ki 0 -f {{path}}",
    ],
  },
  dump: {
    label: "Dump",
    variant: "warning",
    icon: HardDrive,
    commandTemplates: [
      "hf mf eload -f {{path}}",
      "hf iclass eload -f {{path}}",
      "hf mfu eload -f {{path}}",
    ],
  },
  script: {
    label: "Script",
    variant: "default",
    icon: FileText,
    commandTemplates: ["script run {{path}}"],
  },
  raw: {
    label: "Binary",
    variant: "secondary",
    icon: FileText,
    commandTemplates: ["data load -f {{path}}", "data save -f {{path}}"],
  },
};
