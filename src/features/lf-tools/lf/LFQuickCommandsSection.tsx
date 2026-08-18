import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/panels/shared/SectionLabel";

interface LFQuickCommandsSectionProps {
  onCommand: (cmd: string) => void;
  disabled?: boolean;
}

export function LFQuickCommandsSection({
  onCommand,
  disabled = false,
}: LFQuickCommandsSectionProps) {
  return (
    <div className="p-3 space-y-2">
      <SectionLabel>Quick Commands</SectionLabel>
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCommand("lf t55xx detect")}
          disabled={disabled}
          className="h-6 text-[10px]"
        >
          T55xx Detect
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCommand("lf em 410x reader")}
          disabled={disabled}
          className="h-6 text-[10px]"
        >
          EM410x Read
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCommand("lf hid reader")}
          disabled={disabled}
          className="h-6 text-[10px]"
        >
          HID Read
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCommand("lf awid read")}
          disabled={disabled}
          className="h-6 text-[10px]"
        >
          AWID Read
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCommand("data plot")}
          disabled={disabled}
          className="h-6 text-[10px]"
        >
          Plot Data
        </Button>
      </div>
    </div>
  );
}
