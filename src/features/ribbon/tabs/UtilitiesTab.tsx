import { FileCode2, Layers } from "lucide-react";
import { RibbonStrip, RibbonDivider, RibbonGroup, RibbonButton } from "../primitives";

interface UtilitiesTabProps {
  onWorkspaceChange: (value: string) => void;
}

/**
 * The utilities are pure offline calculators, so this strip has no commands to
 * run — it links to the two workspaces that consume their output instead.
 */
export function UtilitiesTab({ onWorkspaceChange }: UtilitiesTabProps) {
  return (
    <RibbonStrip>
      <RibbonGroup title="Open">
        <RibbonButton
          icon={<FileCode2 />}
          label="Hex viewer"
          onClick={() => onWorkspaceChange("hex")}
          variant="outline"
        />
        <RibbonButton
          icon={<Layers />}
          label="Memory map"
          onClick={() => onWorkspaceChange("memory")}
          variant="outline"
        />
      </RibbonGroup>
      <RibbonDivider />
      <div className="text-xs text-muted-foreground">
        APDU, PN532, UID and checksum helpers run locally with no external services.
      </div>
    </RibbonStrip>
  );
}

export default UtilitiesTab;
