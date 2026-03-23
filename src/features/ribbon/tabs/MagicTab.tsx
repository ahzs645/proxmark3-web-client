import { Separator } from "@/components/ui/separator";
import { CreditCard, Download, Search, Square, Wand2 } from "lucide-react";
import { CompactGroup, MiniButton } from "../primitives";

interface MagicTabProps {
  commandsEnabled: boolean;
  onCommand: (cmd: string) => void;
}

export function MagicTab({ commandsEnabled, onCommand }: MagicTabProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
      <CompactGroup title="Detect">
        <MiniButton
          icon={<Search className="h-3 w-3" />}
          label="Info"
          onClick={() => onCommand("hf mf info")}
          disabled={!commandsEnabled}
          variant="default"
        />
        <MiniButton
          icon={<CreditCard className="h-3 w-3" />}
          label="Gen1 Test"
          onClick={() => onCommand("hf 14a raw -a -k -b 7 40")}
          disabled={!commandsEnabled}
        />
      </CompactGroup>
      <Separator orientation="vertical" className="h-14 shrink-0" />
      <CompactGroup title="Operations">
        <MiniButton
          icon={<Wand2 className="h-3 w-3" />}
          label="View"
          onClick={() => onCommand("hf mf cview")}
          disabled={!commandsEnabled}
        />
        <MiniButton
          icon={<Download className="h-3 w-3" />}
          label="Dump"
          onClick={() => onCommand("hf mf dump")}
          disabled={!commandsEnabled}
        />
        <MiniButton
          icon={<Square className="h-3 w-3" />}
          label="Wipe"
          onClick={() => onCommand("hf mf cwipe")}
          disabled={!commandsEnabled}
        />
      </CompactGroup>
      <Separator orientation="vertical" className="h-14 shrink-0" />
      <div className="text-xs text-muted-foreground">
        Use the panel below for UID write and Block 0 operations
      </div>
    </div>
  );
}

export default MagicTab;
