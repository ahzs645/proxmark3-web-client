import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTarget } from "./context";
import { getNextSteps } from "./nextSteps";

interface NextStepBarProps {
  /** Run a pm3 command (for action steps). */
  onCommand: (cmd: string) => void;
  /** Open a workspace tab (for navigation steps). */
  onOpenTab: (tab: string) => void;
  /** Disables command steps when the client can't run commands yet. */
  commandsDisabled?: boolean;
}

/**
 * A persistent strip of "what to do next" derived from the active card target.
 * Always visible across panels, so the guided workflow that used to live only
 * in the sidebar follows the user wherever they are.
 */
export function NextStepBar({ onCommand, onOpenTab, commandsDisabled = false }: NextStepBarProps) {
  const { target } = useTarget();
  const steps = useMemo(() => getNextSteps(target), [target]);
  if (!steps.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background/50 px-4 py-1.5">
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <ArrowRight className="h-3 w-3" />
        Next
      </span>
      {steps.map((step) => (
        <Button
          key={step.label}
          size="sm"
          variant={step.variant || "outline"}
          className="h-7 gap-1.5 text-xs"
          disabled={Boolean(step.command) && commandsDisabled}
          title={step.hint}
          onClick={() => {
            if (step.command) onCommand(step.command);
            else if (step.tab) onOpenTab(step.tab);
          }}
        >
          <step.icon className="h-3.5 w-3.5" />
          {step.label}
        </Button>
      ))}
    </div>
  );
}
