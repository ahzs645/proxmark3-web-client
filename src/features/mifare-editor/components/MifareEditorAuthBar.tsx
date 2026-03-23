import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CachedAsset } from "@/components/panels/KeyCachePanel";
import type { KeyType } from "../types";
import { Database, Download, Key } from "lucide-react";

interface MifareEditorAuthBarProps {
  keyValue: string;
  keyType: KeyType;
  targetBlock: string;
  dumpChoices: CachedAsset[];
  keyChoices: CachedAsset[];
  disabled?: boolean;
  onKeyChange: (value: string) => void;
  onKeyTypeChange: (value: KeyType) => void;
  onTargetBlockChange: (value: string) => void;
  onReadTargetBlock: () => void;
  onLoadDump: (item: CachedAsset) => void;
  onLoadKeys: (item: CachedAsset) => void;
}

export function MifareEditorAuthBar({
  keyValue,
  keyType,
  targetBlock,
  dumpChoices,
  keyChoices,
  disabled,
  onKeyChange,
  onKeyTypeChange,
  onTargetBlockChange,
  onReadTargetBlock,
  onLoadDump,
  onLoadKeys,
}: MifareEditorAuthBarProps) {
  return (
    <div className="space-y-3 border-b bg-secondary/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Auth:</span>
          <Input
            value={keyValue}
            onChange={(e) => onKeyChange(e.target.value)}
            placeholder="Key (12 hex)"
            className="h-8 w-32 font-mono text-xs"
            maxLength={12}
          />
          <div className="overflow-hidden rounded-md border">
            <Button
              size="sm"
              variant={keyType === "A" ? "default" : "ghost"}
              onClick={() => onKeyTypeChange("A")}
              className="h-8 w-10 rounded-none text-xs"
            >
              A
            </Button>
            <Button
              size="sm"
              variant={keyType === "B" ? "default" : "ghost"}
              onClick={() => onKeyTypeChange("B")}
              className="h-8 w-10 rounded-none text-xs"
            >
              B
            </Button>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Block:</span>
          <Input
            value={targetBlock}
            onChange={(e) => onTargetBlockChange(e.target.value)}
            placeholder="0"
            className="h-8 w-16 font-mono text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={onReadTargetBlock}
            disabled={disabled}
            className="h-8 text-xs"
          >
            <Download className="mr-1 h-3 w-3" />
            Read
          </Button>
        </div>
      </div>

      {dumpChoices.length > 0 || keyChoices.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Database className="h-3 w-3 text-muted-foreground" />
          {dumpChoices.slice(0, 2).map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant="ghost"
              onClick={() => onLoadDump(item)}
              disabled={disabled}
              className="h-6 text-[10px]"
            >
              {item.relativePath || item.name}
            </Button>
          ))}
          {keyChoices.slice(0, 2).map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant="ghost"
              onClick={() => onLoadKeys(item)}
              disabled={disabled}
              className="h-6 text-[10px]"
            >
              <Key className="mr-1 h-2.5 w-2.5" />
              {item.relativePath || item.name}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
