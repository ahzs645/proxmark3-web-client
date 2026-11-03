import { Button } from "@/components/ui/button";
import { PanelSection } from "@/components/panels/shared/PanelSection";

interface T55xxQuickCommandsSectionProps {
  onCommand: (cmd: string) => void;
  disabled?: boolean;
}

export function T55xxQuickCommandsSection({
  onCommand,
  disabled = false,
}: T55xxQuickCommandsSectionProps) {
  return (
    <PanelSection title="Quick Commands" className="space-y-3">
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCommand("lf t55xx config")}
          disabled={disabled}
          className="h-6 text-[10px]"
        >
          Show Config
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCommand("lf t55xx trace")}
          disabled={disabled}
          className="h-6 text-[10px]"
        >
          Trace
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCommand("lf t55xx restore")}
          disabled={disabled}
          className="h-6 text-[10px]"
        >
          Restore
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCommand("lf search")}
          disabled={disabled}
          className="h-6 text-[10px]"
        >
          LF Search
        </Button>
      </div>
    </PanelSection>
  );
}
