import { CreditCard, Download, Search, Square, Wand2 } from "lucide-react";
import { RibbonStrip, RibbonDivider, RibbonGroup, RibbonButton } from "../primitives";

interface MagicTabProps {
  commandsEnabled: boolean;
  onCommand: (cmd: string) => void;
}

export function MagicTab({ commandsEnabled, onCommand }: MagicTabProps) {
  return (
    <RibbonStrip>
      <RibbonGroup title="Detect">
        <RibbonButton
          icon={<Search />}
          label="Info"
          onClick={() => onCommand("hf mf info")}
          disabled={!commandsEnabled}
          variant="default"
        />
        <RibbonButton
          icon={<CreditCard />}
          label="Gen1 Test"
          onClick={() => onCommand("hf 14a raw -a -k -b 7 40")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>
      <RibbonDivider />
      <RibbonGroup title="Operations">
        <RibbonButton
          icon={<Wand2 />}
          label="View"
          onClick={() => onCommand("hf mf cview")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Download />}
          label="Dump"
          onClick={() => onCommand("hf mf dump")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Square />}
          label="Wipe"
          onClick={() => onCommand("hf mf cwipe")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>
      <RibbonDivider />
      <div className="text-xs text-muted-foreground">
        Use the panel below for UID write and Block 0 operations
      </div>
    </RibbonStrip>
  );
}

export default MagicTab;
