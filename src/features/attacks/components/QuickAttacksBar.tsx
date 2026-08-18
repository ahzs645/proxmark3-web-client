import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/panels/shared/SectionLabel";
import { Zap } from "lucide-react";
import { QUICK_ATTACKS } from "../config";

interface QuickAttacksBarProps {
  onRunCommand: (command: string) => void;
  disabled: boolean;
}

export function QuickAttacksBar({ onRunCommand, disabled }: QuickAttacksBarProps) {
  return (
    <div className="border-b bg-secondary/20 p-3">
      <SectionLabel icon={<Zap className="h-3 w-3" />} className="mb-2">
        Quick Attacks
      </SectionLabel>
      <div className="flex flex-wrap gap-2">
        {QUICK_ATTACKS.map((attack) => (
          <Button
            key={attack.label}
            size="sm"
            variant={attack.variant}
            onClick={() => onRunCommand(attack.command)}
            disabled={disabled}
            className="h-7 text-xs"
          >
            {attack.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
