import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/panels/shared/SectionLabel";
import { Input } from "@/components/ui/input";
import { Key } from "lucide-react";
import type { KeyType } from "../types";

interface KnownKeySectionProps {
  knownBlock: string;
  knownKeyType: KeyType;
  knownKey: string;
  onKnownBlockChange: (value: string) => void;
  onKnownKeyTypeChange: (value: KeyType) => void;
  onKnownKeyChange: (value: string) => void;
  defaultKeys: string[];
}

export function KnownKeySection({
  knownBlock,
  knownKeyType,
  knownKey,
  onKnownBlockChange,
  onKnownKeyTypeChange,
  onKnownKeyChange,
  defaultKeys,
}: KnownKeySectionProps) {
  return (
    <div className="space-y-3">
      <SectionLabel icon={<Key className="h-3 w-3" />}>Known Key (Source)</SectionLabel>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Block</label>
          <Input
            value={knownBlock}
            onChange={(e) => onKnownBlockChange(e.target.value)}
            className="h-8 font-mono text-xs"
            placeholder="0"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Key Type</label>
          <div className="flex h-8 overflow-hidden rounded-md border">
            <Button
              size="sm"
              variant={knownKeyType === "A" ? "default" : "ghost"}
              onClick={() => onKnownKeyTypeChange("A")}
              className="h-full flex-1 rounded-none text-xs"
            >
              A
            </Button>
            <Button
              size="sm"
              variant={knownKeyType === "B" ? "default" : "ghost"}
              onClick={() => onKnownKeyTypeChange("B")}
              className="h-full flex-1 rounded-none text-xs"
            >
              B
            </Button>
          </div>
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-[10px] text-muted-foreground">Key (12 hex)</label>
          <Input
            value={knownKey}
            onChange={(e) => onKnownKeyChange(e.target.value)}
            className="h-8 font-mono text-xs"
            placeholder="FFFFFFFFFFFF"
            maxLength={12}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {defaultKeys.slice(0, 4).map((key) => (
          <Button
            key={key}
            size="sm"
            variant="ghost"
            onClick={() => onKnownKeyChange(key)}
            className="h-6 px-2 font-mono text-[10px]"
          >
            {key}
          </Button>
        ))}
      </div>
    </div>
  );
}
