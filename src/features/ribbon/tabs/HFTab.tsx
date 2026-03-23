import { Separator } from "@/components/ui/separator";
import { Select } from "@/components/ui/select";
import { Eye, Search } from "lucide-react";
import { HF_CARD_OPERATIONS, HF_CARD_TYPES, getIcon } from "../config";
import { CompactGroup, MiniButton } from "../primitives";

interface HFTabProps {
  commandsEnabled: boolean;
  selectedHFCardType: string;
  onSelectedHFCardTypeChange: (value: string) => void;
  onCommand: (cmd: string) => void;
}

export function HFTab({
  commandsEnabled,
  selectedHFCardType,
  onSelectedHFCardTypeChange,
  onCommand,
}: HFTabProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
      <CompactGroup title="Search">
        <MiniButton
          icon={<Search className="h-3 w-3" />}
          label="Search"
          onClick={() => onCommand("hf search")}
          disabled={!commandsEnabled}
          variant="default"
        />
        <MiniButton
          icon={<Search className="h-3 w-3" />}
          label="14A Info"
          onClick={() => onCommand("hf 14a info")}
          disabled={!commandsEnabled}
        />
        <MiniButton
          icon={<Eye className="h-3 w-3" />}
          label="Sniff"
          onClick={() => onCommand("hf sniff")}
          disabled={!commandsEnabled}
        />
      </CompactGroup>

      <Separator orientation="vertical" className="h-14 shrink-0" />

      <div className="flex shrink-0 flex-col gap-1">
        <div className="px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Card Type
        </div>
        <Select
          value={selectedHFCardType}
          onValueChange={onSelectedHFCardTypeChange}
          options={HF_CARD_TYPES}
          className="w-40"
        />
      </div>

      <Separator orientation="vertical" className="h-14 shrink-0" />

      <CompactGroup
        title={
          HF_CARD_TYPES.find((card) => card.value === selectedHFCardType)?.label || "Operations"
        }
      >
        {(HF_CARD_OPERATIONS[selectedHFCardType] || []).map((op) => (
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

export default HFTab;
