import { Badge } from "@/components/ui/badge";
import { Download, FileJson, FolderOpen, Play, RefreshCw, Upload } from "lucide-react";
import {
  RibbonStrip,
  RibbonDivider,
  RibbonGroup,
  RibbonButton,
  RibbonUploadButton,
  RIBBON_CONTROL,
} from "../primitives";

interface MemoryTabProps {
  commandsEnabled: boolean;
  cacheItemsLength: number;
  cacheSyncing?: boolean;
  onCommand: (cmd: string) => void;
  onJsonUpload?: (files: FileList | null) => void;
  onCacheUpload: (files: FileList | null) => void;
  onCacheSync: () => void;
}

export function MemoryTab({
  commandsEnabled,
  cacheItemsLength,
  cacheSyncing,
  onCommand,
  onJsonUpload,
  onCacheUpload,
  onCacheSync,
}: MemoryTabProps) {
  return (
    <RibbonStrip>
      <RibbonGroup title="Import">
        <RibbonUploadButton
          icon={<FileJson />}
          label="Card Dump"
          accept=".json,.bin,.dump,.eml,.txt"
          onFiles={(files) => onJsonUpload?.(files)}
          variant="default"
        />
        <RibbonUploadButton
          icon={<FolderOpen />}
          label="Folder"
          directory
          multiple
          onFiles={onCacheUpload}
        />
        <RibbonUploadButton
          icon={<Upload />}
          label="Files"
          accept=".bin,.dump,.eml,.dic,.json,.key"
          multiple
          onFiles={onCacheUpload}
        />
      </RibbonGroup>

      <RibbonDivider />

      <RibbonGroup title="Card Operations">
        <RibbonButton
          icon={<Upload />}
          label="Restore CLI"
          onClick={() => onCommand("hf mf restore")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>

      <RibbonDivider />

      <RibbonGroup title="Emulator">
        <RibbonButton
          icon={<Download />}
          label="Load"
          onClick={() => onCommand("hf mf eload")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Upload />}
          label="Save"
          onClick={() => onCommand("hf mf esave")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Play />}
          label="Simulate"
          onClick={() => onCommand("hf mf sim --1k")}
          disabled={!commandsEnabled}
        />
      </RibbonGroup>

      <RibbonDivider />

      <RibbonGroup title="Cache">
        <RibbonButton
          icon={<RefreshCw className={cacheSyncing ? "animate-spin" : undefined} />}
          label="Sync"
          onClick={onCacheSync}
          disabled={!commandsEnabled || cacheSyncing}
        />
        <Badge variant="secondary" className={RIBBON_CONTROL}>
          {cacheItemsLength} files
        </Badge>
      </RibbonGroup>
    </RibbonStrip>
  );
}

export default MemoryTab;
