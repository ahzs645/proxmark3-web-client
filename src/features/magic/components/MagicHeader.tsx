import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Wand2, RefreshCw } from "lucide-react";

interface MagicHeaderProps {
  disabled?: boolean;
  onDetect: () => void;
}

export function MagicHeader({ disabled = false, onDetect }: MagicHeaderProps) {
  return (
    <CardHeader className="border-b pb-2">
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Wand2 className="h-4 w-4 text-primary" />
          Magic Card Operations
          <Badge variant="outline" className="ml-1">
            UID Writable
          </Badge>
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={onDetect}
          disabled={disabled}
          className="h-7 gap-1 text-xs"
        >
          <RefreshCw className="h-3 w-3" />
          Detect
        </Button>
      </div>
    </CardHeader>
  );
}
