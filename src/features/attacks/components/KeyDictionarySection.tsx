import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/panels/shared/SectionLabel";
import { FileKey } from "lucide-react";
import type { CachedAsset } from "@/components/panels/KeyCachePanel";

interface KeyDictionarySectionProps {
  keyFiles: CachedAsset[];
  selectedKeyFile: string | null;
  onSelectedKeyFileChange: (value: string | null) => void;
}

export function KeyDictionarySection({
  keyFiles,
  selectedKeyFile,
  onSelectedKeyFileChange,
}: KeyDictionarySectionProps) {
  return (
    <div className="space-y-2">
      <SectionLabel icon={<FileKey className="h-3 w-3" />}>Key Dictionary (Optional)</SectionLabel>
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant={selectedKeyFile === null ? "secondary" : "ghost"}
          onClick={() => onSelectedKeyFileChange(null)}
          className="h-6 text-[10px]"
        >
          Default
        </Button>
        {keyFiles.map((keyFile) => {
          const filePath = keyFile.relativePath || keyFile.name;
          return (
            <Button
              key={keyFile.id}
              size="sm"
              variant={selectedKeyFile === filePath ? "secondary" : "ghost"}
              onClick={() => onSelectedKeyFileChange(filePath)}
              className="h-6 text-[10px]"
            >
              {filePath}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
