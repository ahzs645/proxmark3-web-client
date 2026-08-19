import { Download, Eye, Radio, Search, Settings, Zap } from "lucide-react";
import { RibbonStrip, RibbonDivider, RibbonGroup, RibbonButton } from "../primitives";

interface LFOpsTabProps {
  commandsEnabled: boolean;
  onCommand: (cmd: string) => void;
}

export function LFOpsTab({ commandsEnabled, onCommand }: LFOpsTabProps) {
  return (
    <RibbonStrip>
      <RibbonGroup title="Basic">
        <RibbonButton
          icon={<Search />}
          label="Search"
          onClick={() => onCommand("lf search")}
          disabled={!commandsEnabled}
          variant="default"
        />
        <RibbonButton
          icon={<Zap />}
          label="Tune"
          onClick={() => onCommand("hw tune --lf")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Download />}
          label="Read"
          onClick={() => onCommand("lf read -s 40000")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Eye />}
          label="Sniff"
          onClick={() => onCommand("lf sniff")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>
      <RibbonDivider />
      <RibbonGroup title="Config">
        <RibbonButton
          icon={<Settings />}
          label="Status"
          onClick={() => onCommand("hw status")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Radio />}
          label="125kHz"
          onClick={() => onCommand("lf config -d 95")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Radio />}
          label="134kHz"
          onClick={() => onCommand("lf config -d 88")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>
      <RibbonDivider />
      <div className="text-xs text-muted-foreground">
        Use the panel below for advanced frequency config
      </div>
    </RibbonStrip>
  );
}

export default LFOpsTab;
