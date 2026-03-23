import { Separator } from "@/components/ui/separator";
import { Download, Eye, Radio, Search, Settings, Zap } from "lucide-react";
import { CompactGroup, MiniButton } from "../primitives";

interface LFOpsTabProps {
  commandsEnabled: boolean;
  onCommand: (cmd: string) => void;
}

export function LFOpsTab({ commandsEnabled, onCommand }: LFOpsTabProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
      <CompactGroup title="Basic">
        <MiniButton
          icon={<Search className="h-3 w-3" />}
          label="Search"
          onClick={() => onCommand("lf search")}
          disabled={!commandsEnabled}
          variant="default"
        />
        <MiniButton
          icon={<Zap className="h-3 w-3" />}
          label="Tune"
          onClick={() => onCommand("hw tune --lf")}
          disabled={!commandsEnabled}
        />
        <MiniButton
          icon={<Download className="h-3 w-3" />}
          label="Read"
          onClick={() => onCommand("lf read -s 40000")}
          disabled={!commandsEnabled}
        />
        <MiniButton
          icon={<Eye className="h-3 w-3" />}
          label="Sniff"
          onClick={() => onCommand("lf sniff")}
          disabled={!commandsEnabled}
        />
      </CompactGroup>
      <Separator orientation="vertical" className="h-14 shrink-0" />
      <CompactGroup title="Config">
        <MiniButton
          icon={<Settings className="h-3 w-3" />}
          label="Status"
          onClick={() => onCommand("hw status")}
          disabled={!commandsEnabled}
        />
        <MiniButton
          icon={<Radio className="h-3 w-3" />}
          label="125kHz"
          onClick={() => onCommand("lf config -d 95")}
          disabled={!commandsEnabled}
        />
        <MiniButton
          icon={<Radio className="h-3 w-3" />}
          label="134kHz"
          onClick={() => onCommand("lf config -d 88")}
          disabled={!commandsEnabled}
        />
      </CompactGroup>
      <Separator orientation="vertical" className="h-14 shrink-0" />
      <div className="text-xs text-muted-foreground">
        Use the panel below for advanced frequency config
      </div>
    </div>
  );
}

export default LFOpsTab;
