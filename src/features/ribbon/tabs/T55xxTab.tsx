import { Separator } from "@/components/ui/separator";
import { Copy, Download, Key, Radio, Search, Square } from "lucide-react";
import { CompactGroup, MiniButton } from "../primitives";

interface T55xxTabProps {
  commandsEnabled: boolean;
  onCommand: (cmd: string) => void;
}

export function T55xxTab({ commandsEnabled, onCommand }: T55xxTabProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
      <CompactGroup title="T55xx">
        <MiniButton
          icon={<Search className="h-3 w-3" />}
          label="Detect"
          onClick={() => onCommand("lf t55xx detect")}
          disabled={!commandsEnabled}
          variant="default"
        />
        <MiniButton
          icon={<Download className="h-3 w-3" />}
          label="Dump"
          onClick={() => onCommand("lf t55xx dump")}
          disabled={!commandsEnabled}
        />
        <MiniButton
          icon={<Square className="h-3 w-3" />}
          label="Wipe"
          onClick={() => onCommand("lf t55xx wipe")}
          disabled={!commandsEnabled}
        />
        <MiniButton
          icon={<Key className="h-3 w-3" />}
          label="Chk Pwd"
          onClick={() => onCommand("lf t55xx chk")}
          disabled={!commandsEnabled}
        />
      </CompactGroup>
      <Separator orientation="vertical" className="h-14 shrink-0" />
      <CompactGroup title="EM410x">
        <MiniButton
          icon={<Radio className="h-3 w-3" />}
          label="Read"
          onClick={() => onCommand("lf em 410x reader")}
          disabled={!commandsEnabled}
        />
        <MiniButton
          icon={<Copy className="h-3 w-3" />}
          label="Clone"
          onClick={() => onCommand("lf em 410x clone --id 0102030405")}
          disabled={!commandsEnabled}
        />
      </CompactGroup>
      <Separator orientation="vertical" className="h-14 shrink-0" />
      <div className="text-xs text-muted-foreground">
        Use the panel below for detailed operations
      </div>
    </div>
  );
}

export default T55xxTab;
