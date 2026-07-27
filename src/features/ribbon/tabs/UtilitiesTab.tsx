import { Separator } from "@/components/ui/separator";
import { FileCode2, Layers } from "lucide-react";
import { MiniButton, CompactGroup } from "../primitives";

interface UtilitiesTabProps {
  onWorkspaceChange: (value: string) => void;
}

/**
 * The utilities are pure offline calculators, so this strip has no commands to
 * run — it links to the two workspaces that consume their output instead.
 */
export function UtilitiesTab({ onWorkspaceChange }: UtilitiesTabProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
      <CompactGroup title="Open">
        <MiniButton
          icon={<FileCode2 className="h-3 w-3" />}
          label="Hex viewer"
          onClick={() => onWorkspaceChange("hex")}
          variant="outline"
        />
        <MiniButton
          icon={<Layers className="h-3 w-3" />}
          label="Memory map"
          onClick={() => onWorkspaceChange("memory")}
          variant="outline"
        />
      </CompactGroup>
      <Separator orientation="vertical" className="h-14 shrink-0" />
      <div className="text-xs text-muted-foreground">
        APDU, PN532, UID and checksum helpers run locally with no external services.
      </div>
    </div>
  );
}

export default UtilitiesTab;
