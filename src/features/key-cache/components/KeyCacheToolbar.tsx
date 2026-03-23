import { useEffect, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen, Upload } from "lucide-react";

interface KeyCacheToolbarProps {
  inputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;
  onUpload: (files: FileList | null) => void;
  onSync: () => void;
  syncing?: boolean;
  hasItems: boolean;
  cachePathPrefix: string;
}

export function KeyCacheToolbar({
  inputRef,
  folderInputRef,
  onUpload,
  onSync,
  syncing,
  hasItems,
  cachePathPrefix,
}: KeyCacheToolbarProps) {
  useEffect(() => {
    if (!folderInputRef.current) return;
    folderInputRef.current.setAttribute("webkitdirectory", "");
    folderInputRef.current.setAttribute("directory", "");
  }, [folderInputRef]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="secondary"
          size="sm"
          className="gap-2"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Upload keys / dumps
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => folderInputRef.current?.click()}
        >
          <FolderOpen className="h-4 w-4" />
          Import folder
        </Button>
        <Button variant="outline" size="sm" onClick={onSync} disabled={syncing || !hasItems}>
          {syncing ? "Syncing..." : "Push to WASM FS"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => onUpload(e.target.files)}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => onUpload(e.target.files)}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Files are cached under `{cachePathPrefix}/&lt;relative path&gt;` so you can run autopwn, mem
        load, or emulator commands without re-uploading.
      </p>
    </div>
  );
}
