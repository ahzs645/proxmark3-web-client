import { Button } from "@/components/ui/button";
import type { CardType } from "../types";

interface AttacksHeaderProps {
  cardType: CardType;
  onCardTypeChange: (cardType: CardType) => void;
}

export function AttacksHeader({ cardType, onCardTypeChange }: AttacksHeaderProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant={cardType === "1k" ? "default" : "ghost"}
        onClick={() => onCardTypeChange("1k")}
        className="h-7 px-2 text-xs"
      >
        1K
      </Button>
      <Button
        size="sm"
        variant={cardType === "4k" ? "default" : "ghost"}
        onClick={() => onCardTypeChange("4k")}
        className="h-7 px-2 text-xs"
      >
        4K
      </Button>
    </div>
  );
}
