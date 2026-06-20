import { FolderOpen, Layers, Search, type LucideIcon } from "lucide-react";
import { getSuggestedActions } from "@/features/tag-info/helpers";
import type { CardTarget } from "./types";

/**
 * A single recommended action in the workflow spine. Either runs a pm3
 * `command` or navigates to a workspace `tab`.
 */
export interface NextStep {
  label: string;
  hint?: string;
  icon: LucideIcon;
  variant?: "default" | "secondary" | "outline";
  command?: string;
  tab?: string;
}

/**
 * Turn the active card target into an ordered list of "what to do next",
 * promoting the per-card suggested actions out of the sidebar and into the
 * primary flow. This is the single source of truth for the next-step spine.
 */
export function getNextSteps(target: CardTarget): NextStep[] {
  if (!target.hasCard) {
    return [
      {
        label: "Scan HF",
        hint: "Detect a 13.56 MHz card",
        icon: Search,
        variant: "default",
        command: "hf search",
      },
      {
        label: "Scan LF",
        hint: "Detect a 125 kHz tag",
        icon: Search,
        variant: "outline",
        command: "lf search",
      },
    ];
  }

  const steps: NextStep[] = [];

  // With a dump in hand, analyzing its memory is the natural next move.
  if (target.dump) {
    steps.push({
      label: "Analyze memory",
      hint: target.dump.name,
      icon: Layers,
      variant: "default",
      tab: "memory",
    });
  }

  // Card-type specific actions (Autopwn / Dump / Simulate / …) reused from the
  // suggested-actions logic so there is one definition.
  for (const action of getSuggestedActions(target.identity)) {
    steps.push({
      label: action.label,
      hint: action.description,
      icon: action.icon,
      variant: action.variant,
      command: action.command,
    });
  }

  steps.push({
    label: "Library",
    hint: "Saved cards, keys & dumps",
    icon: FolderOpen,
    variant: "outline",
    tab: "library",
  });

  // De-duplicate by label and keep the spine short.
  const seen = new Set<string>();
  return steps.filter((step) => !seen.has(step.label) && seen.add(step.label)).slice(0, 5);
}
