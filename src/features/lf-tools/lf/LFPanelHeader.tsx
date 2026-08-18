import { Badge } from "@/components/ui/badge";
import { PanelHeader } from "@/components/panels/shared/PanelHeader";
import { Radio } from "lucide-react";

interface LFPanelHeaderProps {
  frequency: number;
}

export function LFPanelHeader({ frequency }: LFPanelHeaderProps) {
  return (
    <PanelHeader
      icon={Radio}
      title="LF Operations"
      tag="Low Frequency"
      actions={
        <Badge variant="secondary" className="font-mono text-xs">
          {frequency.toFixed(1)} kHz
        </Badge>
      }
    />
  );
}
