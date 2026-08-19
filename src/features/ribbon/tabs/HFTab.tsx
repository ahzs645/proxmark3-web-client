import { Select } from "@/components/ui/select";
import { Eye, Search } from "lucide-react";
import { HF_CARD_OPERATIONS, HF_CARD_TYPES, getIcon } from "../config";
import { RibbonStrip, RibbonDivider, RibbonGroup, RibbonButton } from "../primitives";

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
    <RibbonStrip>
      <RibbonGroup title="Search">
        <RibbonButton
          icon={<Search />}
          label="Search"
          onClick={() => onCommand("hf search")}
          disabled={!commandsEnabled}
          variant="default"
        />
        <RibbonButton
          icon={<Search />}
          label="14A Info"
          onClick={() => onCommand("hf 14a info")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Eye />}
          label="Sniff"
          onClick={() => onCommand("hf sniff")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>

      <RibbonDivider />

      <RibbonGroup title="Card Type">
        <Select
          value={selectedHFCardType}
          onValueChange={onSelectedHFCardTypeChange}
          options={HF_CARD_TYPES}
          className="w-40"
          size="sm"
        />
      </RibbonGroup>

      <RibbonDivider />

      <RibbonGroup
        title={
          HF_CARD_TYPES.find((card) => card.value === selectedHFCardType)?.label || "Operations"
        }
      >
        {(HF_CARD_OPERATIONS[selectedHFCardType] || []).map((op) => (
          <RibbonButton
            key={op.label}
            icon={getIcon(op.icon)}
            label={op.label}
            onClick={() => onCommand(op.command)}
            disabled={!commandsEnabled}
            variant={op.variant || "outline"}
          />
        ))}
      </RibbonGroup>
    </RibbonStrip>
  );
}

export default HFTab;
