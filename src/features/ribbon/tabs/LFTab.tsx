import { Separator } from "@/components/ui/separator";
import { Select } from "@/components/ui/select";
import { Eye, Radio, Search } from "lucide-react";
import { LF_CARD_OPERATIONS, LF_CARD_TYPES, getIcon } from "../config";
import { CompactGroup, MiniButton } from "../primitives";

interface LFTabProps {
  commandsEnabled: boolean;
  selectedLFCardType: string;
  onSelectedLFCardTypeChange: (value: string) => void;
  onCommand: (cmd: string) => void;
}

export function LFTab({
  commandsEnabled,
  selectedLFCardType,
  onSelectedLFCardTypeChange,
  onCommand,
}: LFTabProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
      <CompactGroup title="Search">
        <MiniButton
          icon={<Search className="h-3 w-3" />}
          label="Search"
          onClick={() => onCommand("lf search")}
          disabled={!commandsEnabled}
          variant="default"
        />
        <MiniButton
          icon={<Radio className="h-3 w-3" />}
          label="Read"
          onClick={() => onCommand("lf read")}
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

      <div className="flex shrink-0 flex-col gap-1">
        <div className="px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Card Type
        </div>
        <Select
          value={selectedLFCardType}
          onValueChange={onSelectedLFCardTypeChange}
          options={LF_CARD_TYPES}
          className="w-32"
        />
      </div>

      <Separator orientation="vertical" className="h-14 shrink-0" />

      <CompactGroup
        title={
          LF_CARD_TYPES.find((card) => card.value === selectedLFCardType)?.label || "Operations"
        }
      >
        {(LF_CARD_OPERATIONS[selectedLFCardType] || []).map((op) => (
          <MiniButton
            key={op.label}
            icon={getIcon(op.icon)}
            label={op.label}
            onClick={() => onCommand(op.command)}
            disabled={!commandsEnabled}
            variant={op.variant || "outline"}
          />
        ))}
      </CompactGroup>
    </div>
  );
}

export default LFTab;
