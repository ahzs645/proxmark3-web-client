import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_TYPES } from "../constants";
import type { CardTypeConfig, MagicCardType } from "../types";

interface MagicCardTypeSectionProps {
  cardType: MagicCardType;
  onCardTypeChange: (value: MagicCardType) => void;
  typeConfig: CardTypeConfig;
}

export function MagicCardTypeSection({
  cardType,
  onCardTypeChange,
  typeConfig,
}: MagicCardTypeSectionProps) {
  return (
    <div className="border-b bg-secondary/20 space-y-3 p-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Card Type:</label>
        <div className="flex flex-wrap overflow-hidden rounded-md border">
          {(["gen1a", "gen2", "gen3", "gen4"] as Exclude<MagicCardType, "unknown">[]).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={cardType === key ? "default" : "ghost"}
              onClick={() => onCardTypeChange(key)}
              className="h-7 rounded-none px-3 text-xs"
            >
              {CARD_TYPES[key].label}
            </Button>
          ))}
        </div>
      </div>
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <CreditCard className={cn("h-3 w-3", typeConfig.color)} />
        {typeConfig.description}
      </p>
    </div>
  );
}
