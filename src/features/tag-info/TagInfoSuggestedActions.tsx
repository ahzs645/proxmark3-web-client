import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SectionLabel } from "@/components/panels/shared/SectionLabel";
import { Zap } from "lucide-react";
import type { SuggestedAction } from "./types";
import { libraryKeyModeOptions, type LibraryKeyMode } from "@/features/keys/libraryKeyCommands";

interface TagInfoSuggestedActionsProps {
  suggestedActions: SuggestedAction[];
  onCommand?: (cmd: string) => void;
  disabled?: boolean;
  libraryKeyMode?: LibraryKeyMode;
  matchingKeyCount?: number;
  libraryKeyCount?: number;
  onLibraryKeyModeChange?: (mode: LibraryKeyMode) => void;
}

export function TagInfoSuggestedActions({
  suggestedActions,
  onCommand,
  disabled = false,
  libraryKeyMode = "default",
  matchingKeyCount = 0,
  libraryKeyCount = 0,
  onLibraryKeyModeChange,
}: TagInfoSuggestedActionsProps) {
  if (!suggestedActions.length || !onCommand) return null;

  return (
    <>
      <Separator />
      <div className="space-y-2">
        <SectionLabel icon={<Zap className="h-3 w-3" />}>Suggested Actions</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {suggestedActions.slice(0, 4).map((action, idx) => {
            const actionButton = (
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
            );

            if (!/\bhf\s+mf\s+autopwn\b/i.test(action.command) || !onLibraryKeyModeChange) {
              return actionButton;
            }

            return (
              <div
                key={`${action.label}-${idx}`}
                className="col-span-2 grid grid-cols-[minmax(0,1fr)_8.5rem] gap-1.5"
              >
                {actionButton}
                <Select
                  value={libraryKeyMode}
                  onValueChange={(value) => onLibraryKeyModeChange(value as LibraryKeyMode)}
                  options={libraryKeyModeOptions(matchingKeyCount, libraryKeyCount)}
                  disabled={disabled}
                  size="sm"
                  className="self-stretch"
                />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
