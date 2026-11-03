import { Button } from "@/components/ui/button";
import { PanelSection } from "@/components/panels/shared/PanelSection";
import { CreditCard, Lock, Trash2, Unlock, Wrench } from "lucide-react";
import type { MagicCardType } from "../types";

interface MagicQuickOperationsSectionProps {
  disabled?: boolean;
  cardType: MagicCardType;
  onUnlock: () => void;
  onViewCard: () => void;
  onWipe: () => void;
  onLoadDump: () => void;
}

export function MagicQuickOperationsSection({
  disabled = false,
  cardType,
  onUnlock,
  onViewCard,
  onWipe,
  onLoadDump,
}: MagicQuickOperationsSectionProps) {
  return (
    <PanelSection title="Quick Operations" icon={<Wrench className="h-3 w-3" />}>
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onUnlock}
          disabled={disabled || (cardType !== "gen1a" && cardType !== "gen4")}
          className="gap-1"
        >
          <Unlock className="h-3 w-3" />
          Unlock
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onViewCard}
          disabled={disabled}
          className="gap-1"
        >
          <CreditCard className="h-3 w-3" />
          View Card
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={onWipe}
          disabled={disabled}
          className="gap-1"
        >
          <Trash2 className="h-3 w-3" />
          Wipe Card
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onLoadDump}
          disabled={disabled}
          className="gap-1"
        >
          <Lock className="h-3 w-3" />
          CLI cload
        </Button>
      </div>
    </PanelSection>
  );
}
