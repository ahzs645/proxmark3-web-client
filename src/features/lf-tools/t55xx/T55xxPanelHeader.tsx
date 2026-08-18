import { Button } from "@/components/ui/button";
import { PanelHeader } from "@/components/panels/shared/PanelHeader";
import { Cpu, Search } from "lucide-react";

interface T55xxPanelHeaderProps {
  disabled?: boolean;
  onDetect: () => void;
}

export function T55xxPanelHeader({ disabled = false, onDetect }: T55xxPanelHeaderProps) {
  return (
    <PanelHeader
      icon={Cpu}
      title="T55xx / EM410x"
      tag="LF Cloning"
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={onDetect}
          disabled={disabled}
          className="h-7 gap-1 text-xs"
        >
          <Search className="h-3 w-3" />
          Detect
        </Button>
      }
    />
  );
}
