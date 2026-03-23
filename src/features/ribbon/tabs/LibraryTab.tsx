import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FolderOpen } from "lucide-react";
import { MiniButton, CompactGroup } from "../primitives";

interface LibraryTabProps {
  onTabChange: (value: string) => void;
}

export function LibraryTab({ onTabChange }: LibraryTabProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
      <CompactGroup title="Library">
        <MiniButton
          icon={<FolderOpen className="h-3 w-3" />}
          label="Memory"
          onClick={() => onTabChange("memory")}
          variant="default"
        />
        <Badge variant="secondary" className="h-7 px-2 text-xs">
          Local browser vault
        </Badge>
      </CompactGroup>
      <Separator orientation="vertical" className="h-14 shrink-0" />
      <div className="text-xs text-muted-foreground">
        Save cards, organize keys, and annotate cached dumps without leaving the browser.
      </div>
    </div>
  );
}

export default LibraryTab;
