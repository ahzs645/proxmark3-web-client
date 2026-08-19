import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Copy, Download, KeyRound, Layers } from "lucide-react";
import { useTarget } from "@/features/target/context";
import { buildKeyDictionary, exportStoredKeys } from "@/components/panels/library/utils";
import { libraryKeyModeOptions, type LibraryKeyMode } from "@/features/keys/libraryKeyCommands";
import {
  RibbonStrip,
  RibbonDivider,
  RibbonGroup,
  RibbonButton,
  RibbonNote,
  RIBBON_CONTROL,
} from "../primitives";

interface LibraryTabProps {
  onCommand: (cmd: string) => void;
  commandsEnabled: boolean;
  libraryKeyMode: LibraryKeyMode;
  onLibraryKeyModeChange: (mode: LibraryKeyMode) => void;
}

/**
 * Commands that belong to the Library workspace: acting on the keys and dumps
 * already held for the active card. (This strip used to be a single button that
 * navigated to the Memory workspace — unrelated to the library in front of you.)
 */
export function LibraryTab({
  onCommand,
  commandsEnabled,
  libraryKeyMode,
  onLibraryKeyModeChange,
}: LibraryTabProps) {
  const { target } = useTarget();
  const hasSavedKeys = target.savedKeyCount > 0;
  const cardType = target.classification.size === "4k" ? "4k" : "1k";

  return (
    <RibbonStrip>
      <RibbonGroup title="Active card">
        <RibbonButton
          icon={<KeyRound />}
          label="Check keys"
          onClick={() => onCommand(`hf mf chk --${cardType} -a`)}
          disabled={!commandsEnabled || !target.hasCard}
          variant="default"
        />
        <RibbonButton
          icon={<Layers />}
          label="Dump"
          onClick={() => onCommand(`hf mf dump --${cardType}`)}
          disabled={!commandsEnabled || !target.hasCard}
        />
        <Select
          value={libraryKeyMode}
          onValueChange={(value) => onLibraryKeyModeChange(value as LibraryKeyMode)}
          options={libraryKeyModeOptions(target.savedKeyCount, target.libraryKeyCount)}
          size="sm"
          className="w-40 shrink-0"
          aria-label="Library key source"
        />
        <Badge
          variant={target.libraryKeyCount ? "secondary" : "outline"}
          className={RIBBON_CONTROL}
        >
          {target.libraryKeyCount} total · {target.savedKeyCount} matching
        </Badge>
      </RibbonGroup>

      <RibbonDivider />

      <RibbonGroup title="Export">
        <RibbonButton
          icon={<Download />}
          label="Keys (JSON)"
          onClick={() => exportStoredKeys(target.savedKeys)}
          disabled={!hasSavedKeys}
        />
        <RibbonButton
          icon={<Copy />}
          label="Copy keys"
          onClick={() => {
            const dictionary = buildKeyDictionary(target.savedKeys, target.uid);
            if (dictionary) void navigator.clipboard.writeText(dictionary);
          }}
          disabled={!hasSavedKeys}
        />
      </RibbonGroup>

      <RibbonDivider />

      <RibbonNote>
        Cards, keys and dumps live in a local browser vault — nothing leaves this machine.
      </RibbonNote>
    </RibbonStrip>
  );
}

export default LibraryTab;
