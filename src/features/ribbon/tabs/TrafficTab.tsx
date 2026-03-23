import { Separator } from "@/components/ui/separator";
import { Radio, Shield, Square } from "lucide-react";
import { CompactGroup, MiniButton } from "../primitives";

interface TrafficTabProps {
  commandsEnabled: boolean;
  onCommand: (cmd: string) => void;
}

export function TrafficTab({ commandsEnabled, onCommand }: TrafficTabProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
      <CompactGroup title="HF Sniff">
        <MiniButton
          icon={<Radio className="h-3 w-3" />}
          label="14A Sniff"
          onClick={() => onCommand("hf 14a sniff -c -r")}
          disabled={!commandsEnabled}
          variant="default"
        />
        <MiniButton
          icon={<Shield className="h-3 w-3" />}
          label="iCLASS"
          onClick={() => onCommand("hf iclass sniff")}
          disabled={!commandsEnabled}
        />
        <MiniButton
          icon={<Radio className="h-3 w-3" />}
          label="15693"
          onClick={() => onCommand("hf 15 sniff")}
          disabled={!commandsEnabled}
        />
      </CompactGroup>
      <Separator orientation="vertical" className="h-14 shrink-0" />
      <CompactGroup title="Trace">
        <MiniButton
          icon={<Square className="h-3 w-3" />}
          label="List 14A"
          onClick={() => onCommand("trace list -t 14a -1")}
          disabled={!commandsEnabled}
        />
        <MiniButton
          icon={<Square className="h-3 w-3" />}
          label="List iClass"
          onClick={() => onCommand("trace list -t iclass -1")}
          disabled={!commandsEnabled}
        />
        <MiniButton
          icon={<Square className="h-3 w-3" />}
          label="Clear"
          onClick={() => onCommand("trace clear")}
          disabled={!commandsEnabled}
        />
      </CompactGroup>
      <Separator orientation="vertical" className="h-14 shrink-0" />
      <div className="text-xs text-muted-foreground">Use the panel below for capture analysis</div>
    </div>
  );
}

export default TrafficTab;
