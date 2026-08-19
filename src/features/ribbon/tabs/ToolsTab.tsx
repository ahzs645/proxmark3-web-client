import { HelpCircle, Key, Play, Settings } from "lucide-react";
import { RibbonStrip, RibbonDivider, RibbonGroup, RibbonButton } from "../primitives";

interface ToolsTabProps {
  commandsEnabled: boolean;
  onCommand: (cmd: string) => void;
}

export function ToolsTab({ commandsEnabled, onCommand }: ToolsTabProps) {
  return (
    <RibbonStrip>
      <RibbonGroup title="Scripts">
        <RibbonButton
          icon={<Play />}
          label="List Scripts"
          onClick={() => onCommand("script list")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Play />}
          label="UID Bruteforce"
          onClick={() => onCommand("script run hf_mf_uidbruteforce -h")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Play />}
          label="Format Card"
          onClick={() => onCommand("script run hf_mf_format -h")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>

      <RibbonDivider />

      <RibbonGroup title="Key Memory">
        <RibbonButton
          icon={<Key />}
          label="Load MFC"
          onClick={() => onCommand("mem load -f mfc_default_keys --mfc")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Key />}
          label="Load iClass"
          onClick={() => onCommand("mem load -f iclass_default_keys --iclass")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Key />}
          label="Load T55xx"
          onClick={() => onCommand("mem load -f t55xx_default_pwds --t55xx")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>

      <RibbonDivider />

      <RibbonGroup title="Help">
        <RibbonButton
          icon={<HelpCircle />}
          label="Help"
          onClick={() => onCommand("help")}
          disabled={false}
        />
        <RibbonButton
          icon={<Settings />}
          label="Prefs"
          onClick={() => onCommand("prefs show")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>
    </RibbonStrip>
  );
}

export default ToolsTab;
