import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Download, FileJson, FolderOpen, Key, Play, RefreshCw, Upload } from "lucide-react";
import { RibbonButton, CompactGroup } from "../primitives";

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
    <div className="flex items-start gap-3 overflow-x-auto scrollbar-hide">
      <CompactGroup title="Import">
        <Button
          variant="default"
          size="sm"
          className="relative h-7 gap-1 overflow-hidden px-2 text-xs"
        >
          <FileJson className="h-3 w-3" />
          JSON Dump
          <input
            type="file"
            accept=".json"
            onChange={(e) => {
              onJsonUpload?.(e.target.files);
              e.target.value = "";
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="relative h-7 gap-1 overflow-hidden px-2 text-xs"
        >
          <FolderOpen className="h-3 w-3" />
          Folder
          <input
            type="file"
            // @ts-expect-error webkitdirectory is not standard
            webkitdirectory=""
            multiple
            onChange={(e) => {
              onCacheUpload(e.target.files);
              e.target.value = "";
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="relative h-7 gap-1 overflow-hidden px-2 text-xs"
        >
          <Upload className="h-3 w-3" />
          Files
          <input
            type="file"
            accept=".bin,.dump,.eml,.dic,.json,.key"
            multiple
            onChange={(e) => {
              onCacheUpload(e.target.files);
              e.target.value = "";
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </Button>
      </CompactGroup>

      <Separator orientation="vertical" className="h-14 shrink-0" />

      <CompactGroup title="Card Operations">
        <RibbonButton
          icon={<Key className="h-3 w-3" />}
          label="Autopwn"
          onClick={() => onCommand("hf mf autopwn --1k")}
          disabled={!commandsEnabled}
          variant="default"
        />
        <RibbonButton
          icon={<Download className="h-3 w-3" />}
          label="Dump"
          onClick={() => onCommand("hf mf dump")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Upload className="h-3 w-3" />}
          label="Restore"
          onClick={() => onCommand("hf mf restore")}
          disabled={!commandsEnabled}
        />
      </CompactGroup>

      <Separator orientation="vertical" className="h-14 shrink-0" />

      <CompactGroup title="Emulator">
        <RibbonButton
          icon={<Download className="h-3 w-3" />}
          label="Load"
          onClick={() => onCommand("hf mf eload")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Upload className="h-3 w-3" />}
          label="Save"
          onClick={() => onCommand("hf mf esave")}
          disabled={!commandsEnabled}
        />
        <RibbonButton
          icon={<Play className="h-3 w-3" />}
          label="Simulate"
          onClick={() => onCommand("hf mf sim --1k")}
          disabled={!commandsEnabled}
        />
      </CompactGroup>

      <Separator orientation="vertical" className="h-14 shrink-0" />

      <CompactGroup title="Cache">
        <RibbonButton
          icon={<RefreshCw className={cacheSyncing ? "h-3 w-3 animate-spin" : "h-3 w-3"} />}
          label="Sync"
          onClick={onCacheSync}
          disabled={!commandsEnabled || cacheSyncing}
        />
        <Badge variant="secondary" className="h-7 px-2 text-xs">
          {cacheItemsLength} files
        </Badge>
      </CompactGroup>
    </div>
  );
}

export default MemoryTab;
