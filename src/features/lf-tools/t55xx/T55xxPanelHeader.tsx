import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, Search } from "lucide-react";

interface T55xxPanelHeaderProps {
  disabled?: boolean;
  onDetect: () => void;
}

export function T55xxPanelHeader({ disabled = false, onDetect }: T55xxPanelHeaderProps) {
  return (
    <CardHeader className="border-b pb-2">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          T55xx / EM410x
          <Badge variant="outline" className="ml-1">
            LF Cloning
          </Badge>
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={onDetect}
          disabled={disabled}
          className="h-7 text-xs gap-1"
        >
          <Search className="h-3 w-3" />
          Detect
        </Button>
      </div>
    </CardHeader>
  );
}
