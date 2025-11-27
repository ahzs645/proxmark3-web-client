import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Upload, Trash2, HardDrive, KeyRound, FileText, DatabaseZap } from "lucide-react";
import { useRef } from "react";

export type CachedAssetKind = "keys" | "dump" | "script" | "raw";

export interface CachedAsset {
  id: string;
  name: string;
  kind: CachedAssetKind;
  size: number;
  updatedAt: number;
  base64?: string;
}

interface KeyCachePanelProps {
  items: CachedAsset[];
  syncing?: boolean;
  onUpload: (files: FileList | null) => void;
  onUse: (item: CachedAsset, template: string) => void;
  onDelete: (id: string) => void;
  onSync: () => void;
  cachePathPrefix?: string;
}

const kindConfig: Record<CachedAssetKind, { label: string; variant: BadgeProps["variant"]; commandTemplates: string[] }> = {
  keys: {
    label: "Keys",
    variant: "success",
    commandTemplates: [
      "mem load -f {{path}} --mfc",
      "hf mf autopwn --1k -f {{path}}",
      "hf iclass managekeys --ki 0 -f {{path}}",
    ],
  },
  dump: {
    label: "Dump",
    variant: "warning",
    commandTemplates: [
      "hf mf eload -f {{path}}",
      "hf iclass eload -f {{path}}",
      "hf mfu eload -f {{path}}",
    ],
  },
  script: {
    label: "Script",
    variant: "default",
    commandTemplates: [
      "script run {{path}}",
    ],
  },
  raw: {
    label: "Binary",
    variant: "secondary",
    commandTemplates: [
      "data load -f {{path}}",
      "data save -f {{path}}",
    ],
  },
};

function prettySize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(timestamp: number): string {
  const delta = Date.now() - timestamp;
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function KeyCachePanel({
  items,
  onUpload,
  onUse,
  onDelete,
  onSync,
  syncing,
  cachePathPrefix = "/pm3-cache",
}: KeyCachePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sortedItems = [...items].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <DatabaseZap className="h-4 w-4" />
            Local Key & Dump Cache
          </span>
          <Badge variant="outline" className="text-[11px]">
            Stored in-browser
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
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
            onClick={onSync}
            disabled={syncing || items.length === 0}
          >
            {syncing ? "Syncing..." : "Push to WASM FS"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onUpload(e.target.files)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Files are cached as `{cachePathPrefix}/&lt;filename&gt;` so you can run autopwn, mem load, or emulator commands without re-uploading.
        </p>

        <Separator />

        {sortedItems.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-3 py-6 text-xs text-muted-foreground text-center">
            Drop a dictionary, dump, or script file to keep it in the browser cache.
          </div>
        )}

        <div className="space-y-2 max-h-80 overflow-auto pr-1">
          {sortedItems.map((item) => (
            <div key={item.id} className="rounded-lg border px-3 py-2 bg-card/50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={kindConfig[item.kind].variant}>
                    {item.kind === "keys" && <KeyRound className="h-3 w-3 mr-1" />}
                    {item.kind === "dump" && <HardDrive className="h-3 w-3 mr-1" />}
                    {item.kind === "script" && <FileText className="h-3 w-3 mr-1" />}
                    {kindConfig[item.kind].label}
                  </Badge>
                  <span className="font-medium text-sm truncate max-w-[160px]" title={item.name}>{item.name}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{prettySize(item.size)}</span>
                  <span>•</span>
                  <span>{relativeTime(item.updatedAt)}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => onDelete(item.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {kindConfig[item.kind].commandTemplates.map((template) => (
                  <Button
                    key={template}
                    size="sm"
                    variant="outline"
                    className="text-[11px]"
                    onClick={() => onUse(item, template)}
                  >
                    {template.replace("{{path}}", `${cachePathPrefix}/${item.name}`)}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default KeyCachePanel;
