import { Radio, Shield, Square } from "lucide-react";
import { RibbonStrip, RibbonDivider, RibbonGroup, RibbonButton } from "../primitives";

interface TrafficTabProps {
  commandsEnabled: boolean;
  onCommand: (cmd: string) => void;
}

export function TrafficTab({ commandsEnabled, onCommand }: TrafficTabProps) {
  return (
    <RibbonStrip>
      <RibbonGroup title="HF Sniff">
        <RibbonButton
          icon={<Radio />}
          label="14A Sniff"
          onClick={() => onCommand("hf 14a sniff -c -r")}
          disabled={!commandsEnabled}
          variant="default"
        />
        <RibbonButton
          icon={<Shield />}
          label="iCLASS"
          onClick={() => onCommand("hf iclass sniff")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Radio />}
          label="15693"
          onClick={() => onCommand("hf 15 sniff")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>
      <RibbonDivider />
      <RibbonGroup title="Trace">
        <RibbonButton
          icon={<Square />}
          label="List 14A"
          onClick={() => onCommand("trace list -t 14a -1")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Square />}
          label="List iClass"
          onClick={() => onCommand("trace list -t iclass -1")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Square />}
          label="Clear"
          onClick={() => onCommand("trace clear")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>
      <RibbonDivider />
      <div className="text-xs text-muted-foreground">Use the panel below for capture analysis</div>
    </RibbonStrip>
  );
}

export default TrafficTab;
