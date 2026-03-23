import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Lock, Trash2, Unlock } from "lucide-react";
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
    <div className="space-y-3 p-3">
      <label className="text-xs uppercase tracking-wide text-muted-foreground">
        Quick Operations
      </label>
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
          Load Dump
        </Button>
      </div>
      <Separator />
    </div>
  );
}
