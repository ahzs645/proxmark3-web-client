import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/panels/shared/SectionLabel";
import { FileKey } from "lucide-react";
import type { CachedAsset } from "@/components/panels/KeyCachePanel";
import type { LibraryKeyMode } from "@/features/keys/libraryKeyCommands";

interface KeyDictionarySectionProps {
  keyFiles: CachedAsset[];
  selectedKeyFile: string | null;
  onSelectedKeyFileChange: (value: string | null) => void;
  libraryKeyMode: LibraryKeyMode;
  matchingKeyCount: number;
  libraryKeyCount: number;
  onLibraryKeyModeChange: (mode: LibraryKeyMode) => void;
}

export function KeyDictionarySection({
  keyFiles,
  selectedKeyFile,
  onSelectedKeyFileChange,
  libraryKeyMode,
  matchingKeyCount,
  libraryKeyCount,
  onLibraryKeyModeChange,
}: KeyDictionarySectionProps) {
  return (
    <div className="space-y-2">
      <SectionLabel icon={<FileKey className="h-3 w-3" />}>Key Dictionary (Optional)</SectionLabel>
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant={selectedKeyFile === null && libraryKeyMode === "default" ? "secondary" : "ghost"}
          onClick={() => {
            onSelectedKeyFileChange(null);
            onLibraryKeyModeChange("default");
          }}
          className="h-6 text-[10px]"
        >
          Default
        </Button>
        <Button
          size="sm"
          variant={libraryKeyMode === "matching" ? "secondary" : "ghost"}
          onClick={() => {
            onSelectedKeyFileChange(null);
            onLibraryKeyModeChange("matching");
          }}
          disabled={matchingKeyCount === 0}
          className="h-6 text-[10px]"
        >
          Matching card ({matchingKeyCount})
        </Button>
        <Button
          size="sm"
          variant={libraryKeyMode === "all" ? "secondary" : "ghost"}
          onClick={() => {
            onSelectedKeyFileChange(null);
            onLibraryKeyModeChange("all");
          }}
          disabled={libraryKeyCount === 0}
          className="h-6 text-[10px]"
        >
          Entire Library ({libraryKeyCount})
        </Button>
        {keyFiles.map((keyFile) => {
          const filePath = keyFile.relativePath || keyFile.name;
          return (
            <Button
              key={keyFile.id}
              size="sm"
              variant={selectedKeyFile === filePath ? "secondary" : "ghost"}
              onClick={() => {
                onSelectedKeyFileChange(filePath);
                onLibraryKeyModeChange("default");
              }}
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
