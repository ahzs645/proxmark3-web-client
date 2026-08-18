import { Button } from "@/components/ui/button";
import { PanelHeader } from "@/components/panels/shared/PanelHeader";
import { Wand2, RefreshCw } from "lucide-react";

interface MagicHeaderProps {
  disabled?: boolean;
  onDetect: () => void;
}

export function MagicHeader({ disabled = false, onDetect }: MagicHeaderProps) {
  return (
    <PanelHeader
      icon={Wand2}
      title="Magic Card Operations"
      tag="UID Writable"
      actions={
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
      }
    />
  );
}
