import { Download, Search, Square, Upload, Zap } from "lucide-react";
import { RibbonStrip, RibbonDivider, RibbonGroup, RibbonButton } from "../primitives";

interface DataTabProps {
  commandsEnabled: boolean;
  onCommand: (cmd: string) => void;
}

export function DataTab({ commandsEnabled, onCommand }: DataTabProps) {
  return (
    <RibbonStrip>
      <RibbonGroup title="Capture">
        <RibbonButton
          icon={<Search />}
          label="Samples"
          onClick={() => onCommand("data samples -n 40000")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Download />}
          label="Save"
          onClick={() => onCommand("data save -f trace.bin")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Upload />}
          label="Load"
          onClick={() => onCommand("data load -f trace.bin")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Square />}
          label="Clear"
          onClick={() => onCommand("data clear")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>

      <RibbonDivider />

      <RibbonGroup title="Analysis">
        <RibbonButton
          icon={<Search />}
          label="Autocorr"
          onClick={() => onCommand("data autocorr")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Zap />}
          label="Detect Clk"
          onClick={() => onCommand("data detectclock")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>

      <RibbonDivider />

      <RibbonGroup title="Convert">
        <RibbonButton
          icon={<Download />}
          label="bin→eml"
          onClick={() => onCommand("script run data_mf_bin2eml -h")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Upload />}
          label="eml→bin"
          onClick={() => onCommand("script run data_mf_eml2bin -h")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>
    </RibbonStrip>
  );
}

export default DataTab;
