import { Separator } from "@/components/ui/separator";
import { Key, Shield, Zap } from "lucide-react";
import { CompactGroup, MiniButton } from "../primitives";

interface AttacksTabProps {
  commandsEnabled: boolean;
  onCommand: (cmd: string) => void;
}

export function AttacksTab({ commandsEnabled, onCommand }: AttacksTabProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
      <CompactGroup title="Quick Attacks">
        <MiniButton
          icon={<Zap className="h-3 w-3" />}
          label="Autopwn 1K"
          onClick={() => onCommand("hf mf autopwn --1k")}
          disabled={!commandsEnabled}
          variant="default"
        />
        <MiniButton
          icon={<Zap className="h-3 w-3" />}
          label="Autopwn 4K"
          onClick={() => onCommand("hf mf autopwn --4k")}
          disabled={!commandsEnabled}
        />
        <MiniButton
          icon={<Shield className="h-3 w-3" />}
          label="Darkside"
          onClick={() => onCommand("hf mf darkside")}
          disabled={!commandsEnabled}
        />
        <MiniButton
          icon={<Key className="h-3 w-3" />}
          label="Check Keys"
          onClick={() => onCommand("hf mf chk --1k")}
          disabled={!commandsEnabled}
        />
      </CompactGroup>
      <Separator orientation="vertical" className="h-14 shrink-0" />
      <div className="text-xs text-muted-foreground">
        Use the panel below for advanced attack configuration
      </div>
    </div>
  );
}

export default AttacksTab;
