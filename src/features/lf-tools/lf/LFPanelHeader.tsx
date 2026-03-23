import { Badge } from "@/components/ui/badge";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Radio } from "lucide-react";

interface LFPanelHeaderProps {
  frequency: number;
}

export function LFPanelHeader({ frequency }: LFPanelHeaderProps) {
  return (
    <CardHeader className="border-b pb-2">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          LF Operations
          <Badge variant="outline" className="ml-1">
            Low Frequency
          </Badge>
        </CardTitle>
        <Badge variant="secondary" className="font-mono text-xs">
          {frequency.toFixed(1)} kHz
        </Badge>
      </div>
    </CardHeader>
  );
}
