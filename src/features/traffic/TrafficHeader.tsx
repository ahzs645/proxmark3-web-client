import { Badge } from "@/components/ui/badge";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Radio } from "lucide-react";

interface TrafficHeaderProps {
  isCapturing: boolean;
}

export function TrafficHeader({ isCapturing }: TrafficHeaderProps) {
  return (
    <CardHeader className="border-b pb-2">
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Radio className="h-4 w-4 text-primary" />
          Traffic Capture
          <Badge variant="outline" className="ml-1">
            Sniff & Trace
          </Badge>
        </CardTitle>
        <Badge variant={isCapturing ? "default" : "secondary"} className="animate-pulse">
          {isCapturing ? "Capturing..." : "Idle"}
        </Badge>
      </div>
    </CardHeader>
  );
}
