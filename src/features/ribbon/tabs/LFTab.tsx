import { Select } from "@/components/ui/select";
import { Eye, Radio, Search } from "lucide-react";
import { LF_CARD_OPERATIONS, LF_CARD_TYPES, getIcon } from "../config";
import { RibbonStrip, RibbonDivider, RibbonGroup, RibbonButton } from "../primitives";

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
    <RibbonStrip>
      <RibbonGroup title="Search">
        <RibbonButton
          icon={<Search />}
          label="Search"
          onClick={() => onCommand("lf search")}
          disabled={!commandsEnabled}
          variant="default"
        />
        <RibbonButton
          icon={<Radio />}
          label="Read"
          onClick={() => onCommand("lf read")}
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

      <RibbonGroup title="Card Type">
        <Select
          value={selectedLFCardType}
          onValueChange={onSelectedLFCardTypeChange}
          options={LF_CARD_TYPES}
          className="w-32"
          size="sm"
        />
      </RibbonGroup>

      <RibbonDivider />

      <RibbonGroup
        title={
          LF_CARD_TYPES.find((card) => card.value === selectedLFCardType)?.label || "Operations"
        }
      >
        {(LF_CARD_OPERATIONS[selectedLFCardType] || []).map((op) => (
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

export default LFTab;
