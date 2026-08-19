import { Copy, Download, Key, Radio, Search, Square } from "lucide-react";
import { RibbonStrip, RibbonDivider, RibbonGroup, RibbonButton } from "../primitives";

interface T55xxTabProps {
  commandsEnabled: boolean;
  onCommand: (cmd: string) => void;
}

export function T55xxTab({ commandsEnabled, onCommand }: T55xxTabProps) {
  return (
    <RibbonStrip>
      <RibbonGroup title="T55xx">
        <RibbonButton
          icon={<Search />}
          label="Detect"
          onClick={() => onCommand("lf t55xx detect")}
          disabled={!commandsEnabled}
          variant="default"
        />
        <RibbonButton
          icon={<Download />}
          label="Dump"
          onClick={() => onCommand("lf t55xx dump")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Square />}
          label="Wipe"
          onClick={() => onCommand("lf t55xx wipe")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Key />}
          label="Chk Pwd"
          onClick={() => onCommand("lf t55xx chk")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>
      <RibbonDivider />
      <RibbonGroup title="EM410x">
        <RibbonButton
          icon={<Radio />}
          label="Read"
          onClick={() => onCommand("lf em 410x reader")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Copy />}
          label="Clone"
          onClick={() => onCommand("lf em 410x clone --id 0102030405")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>
      <RibbonDivider />
      <div className="text-xs text-muted-foreground">
        Use the panel below for detailed operations
      </div>
    </RibbonStrip>
  );
}

export default T55xxTab;
