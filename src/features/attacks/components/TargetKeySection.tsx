import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Target } from "lucide-react";
import type { KeyType } from "../types";

interface TargetKeySectionProps {
  targetBlock: string;
  targetKeyType: KeyType;
  onTargetBlockChange: (value: string) => void;
  onTargetKeyTypeChange: (value: KeyType) => void;
}

export function TargetKeySection({
  targetBlock,
  targetKeyType,
  onTargetBlockChange,
  onTargetKeyTypeChange,
}: TargetKeySectionProps) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Target className="h-3 w-3" />
        Target Key
      </label>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Block</label>
          <Input
            value={targetBlock}
            onChange={(e) => onTargetBlockChange(e.target.value)}
            className="h-8 font-mono text-xs"
            placeholder="4"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Key Type</label>
          <div className="flex h-8 overflow-hidden rounded-md border">
            <Button
              size="sm"
              variant={targetKeyType === "A" ? "default" : "ghost"}
              onClick={() => onTargetKeyTypeChange("A")}
              className="h-full flex-1 rounded-none text-xs"
            >
              A
            </Button>
            <Button
              size="sm"
              variant={targetKeyType === "B" ? "default" : "ghost"}
              onClick={() => onTargetKeyTypeChange("B")}
              className="h-full flex-1 rounded-none text-xs"
            >
              B
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
