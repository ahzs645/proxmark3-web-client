import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Download, KeyRound, Layers } from "lucide-react";
import { useTarget } from "@/features/target/context";
import { buildKeyDictionary, exportStoredKeys } from "@/components/panels/library/utils";
import { MiniButton, CompactGroup } from "../primitives";

interface LibraryTabProps {
  onCommand: (cmd: string) => void;
  commandsEnabled: boolean;
}

/**
 * Commands that belong to the Library workspace: acting on the keys and dumps
 * already held for the active card. (This strip used to be a single button that
 * navigated to the Memory workspace — unrelated to the library in front of you.)
 */
export function LibraryTab({ onCommand, commandsEnabled }: LibraryTabProps) {
  const { target } = useTarget();
  const hasSavedKeys = target.savedKeyCount > 0;
  const cardType = target.classification.size === "4k" ? "4k" : "1k";

  return (
    <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
      <CompactGroup title="Active card">
        <MiniButton
          icon={<KeyRound className="h-3 w-3" />}
          label="Check keys"
          onClick={() => onCommand(`hf mf chk --${cardType} -a`)}
          disabled={!commandsEnabled || !target.hasCard}
          variant="default"
        />
        <MiniButton
          icon={<Layers className="h-3 w-3" />}
          label="Dump"
          onClick={() => onCommand(`hf mf dump --${cardType}`)}
          disabled={!commandsEnabled || !target.hasCard}
        />
        <Badge variant={hasSavedKeys ? "secondary" : "outline"} className="h-7 px-2 text-xs">
          {target.savedKeyCount} saved key{target.savedKeyCount === 1 ? "" : "s"}
        </Badge>
      </CompactGroup>

      <Separator orientation="vertical" className="h-14 shrink-0" />

      <CompactGroup title="Export">
        <MiniButton
          icon={<Download className="h-3 w-3" />}
          label="Keys (.dic)"
          onClick={() => exportStoredKeys(target.savedKeys)}
          disabled={!hasSavedKeys}
        />
        <MiniButton
          icon={<Copy className="h-3 w-3" />}
          label="Copy keys"
          onClick={() => {
            const dictionary = buildKeyDictionary(target.savedKeys, target.uid);
            if (dictionary) void navigator.clipboard.writeText(dictionary);
          }}
          disabled={!hasSavedKeys}
        />
      </CompactGroup>

      <Separator orientation="vertical" className="h-14 shrink-0" />

      <div className="text-xs text-muted-foreground">
        Cards, keys and dumps live in a local browser vault — nothing leaves this machine.
      </div>
    </div>
  );
}

export default LibraryTab;
