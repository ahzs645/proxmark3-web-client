import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileCode2 } from "lucide-react";
import { MiniButton, CompactGroup } from "../primitives";

interface UtilitiesTabProps {
  onTabChange: (value: string) => void;
}

export function UtilitiesTab({ onTabChange }: UtilitiesTabProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
      <CompactGroup title="Utilities">
        <MiniButton
          icon={<FileCode2 className="h-3 w-3" />}
          label="Hex"
          onClick={() => onTabChange("hex")}
          variant="outline"
        />
        <Badge variant="secondary" className="h-7 px-2 text-xs">
          Offline calculators
        </Badge>
      </CompactGroup>
      <Separator orientation="vertical" className="h-14 shrink-0" />
      <div className="text-xs text-muted-foreground">
        APDU, PN532, UID, and checksum helpers run locally with no external services.
      </div>
    </div>
  );
}

export default UtilitiesTab;
