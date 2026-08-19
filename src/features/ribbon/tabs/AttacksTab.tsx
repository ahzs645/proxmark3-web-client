import { Key, Shield, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { useTarget } from "@/features/target/context";
import { libraryKeyModeOptions, type LibraryKeyMode } from "@/features/keys/libraryKeyCommands";
import { RibbonStrip, RibbonDivider, RibbonGroup, RibbonButton } from "../primitives";

interface AttacksTabProps {
  commandsEnabled: boolean;
  onCommand: (cmd: string) => void;
  libraryKeyMode: LibraryKeyMode;
  onLibraryKeyModeChange: (mode: LibraryKeyMode) => void;
}

export function AttacksTab({
  commandsEnabled,
  onCommand,
  libraryKeyMode,
  onLibraryKeyModeChange,
}: AttacksTabProps) {
  const { target } = useTarget();

  return (
    <RibbonStrip>
      <RibbonGroup title="Quick Attacks">
        <RibbonButton
          icon={<Zap />}
          label="Autopwn 1K"
          onClick={() => onCommand("hf mf autopwn --1k")}
          disabled={!commandsEnabled}
          variant="default"
        />
        <RibbonButton
          icon={<Zap />}
          label="Autopwn 4K"
          onClick={() => onCommand("hf mf autopwn --4k")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Shield />}
          label="Darkside"
          onClick={() => onCommand("hf mf darkside")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Key />}
          label="Check Keys"
          onClick={() => onCommand("hf mf chk --1k")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>
      <RibbonDivider />
      <RibbonGroup title="Dictionary">
        <Select
          value={libraryKeyMode}
          onValueChange={(value) => onLibraryKeyModeChange(value as LibraryKeyMode)}
          options={libraryKeyModeOptions(target.savedKeyCount, target.libraryKeyCount)}
          size="sm"
          className="w-40 shrink-0"
          aria-label="Attack key source"
        />
        <Badge variant={target.libraryKeyCount ? "secondary" : "outline"}>
          {target.libraryKeyCount} total · {target.savedKeyCount} matching
        </Badge>
      </RibbonGroup>
      <RibbonDivider />
      <div className="text-xs text-muted-foreground">
        Use the panel below for advanced attack configuration
      </div>
    </RibbonStrip>
  );
}

export default AttacksTab;
