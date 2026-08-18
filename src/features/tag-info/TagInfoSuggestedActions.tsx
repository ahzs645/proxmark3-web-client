import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SectionLabel } from "@/components/panels/shared/SectionLabel";
import { Zap } from "lucide-react";
import type { SuggestedAction } from "./types";

interface TagInfoSuggestedActionsProps {
  suggestedActions: SuggestedAction[];
  onCommand?: (cmd: string) => void;
  disabled?: boolean;
}

export function TagInfoSuggestedActions({
  suggestedActions,
  onCommand,
  disabled = false,
}: TagInfoSuggestedActionsProps) {
  if (!suggestedActions.length || !onCommand) return null;

  return (
    <>
      <Separator />
      <div className="space-y-2">
        <SectionLabel icon={<Zap className="h-3 w-3" />}>Suggested Actions</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {suggestedActions.slice(0, 4).map((action, idx) => (
            <Button
              key={`${action.label}-${idx}`}
              size="sm"
              variant={action.variant || "outline"}
              className="flex h-auto flex-col items-start gap-0.5 px-2 py-2 text-left"
              onClick={() => onCommand(action.command)}
              disabled={disabled}
            >
              <span className="flex items-center gap-1 text-xs font-medium">
                <action.icon className="h-3.5 w-3.5" />
                {action.label}
              </span>
              {action.description ? (
                <span
                  className={`text-[9px] font-normal ${
                    action.variant === "default"
                      ? "text-primary-foreground/75"
                      : action.variant === "secondary"
                        ? "text-secondary-foreground/70"
                        : "text-muted-foreground"
                  }`}
                >
                  {action.description}
                </span>
              ) : null}
            </Button>
          ))}
        </div>
      </div>
    </>
  );
}
