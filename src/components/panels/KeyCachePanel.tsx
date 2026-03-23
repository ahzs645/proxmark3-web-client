import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatabaseZap } from "lucide-react";
import { KeyCacheItemList } from "@/features/key-cache/components/KeyCacheItemList";
import { KeyCacheToolbar } from "@/features/key-cache/components/KeyCacheToolbar";
import type { CachedAsset } from "@/features/key-cache/types";

interface KeyCachePanelProps {
  items: CachedAsset[];
  syncing?: boolean;
  onUpload: (files: FileList | null) => void;
  onUse: (item: CachedAsset, template: string) => void;
  onDelete: (id: string) => void;
  onSync: () => void;
  cachePathPrefix?: string;
}

export type { CachedAssetKind, CachedAsset } from "@/features/key-cache/types";

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
  const folderInputRef = useRef<HTMLInputElement>(null);

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
        <KeyCacheToolbar
          inputRef={inputRef}
          folderInputRef={folderInputRef}
          onUpload={onUpload}
          onSync={onSync}
          syncing={syncing}
          hasItems={items.length > 0}
          cachePathPrefix={cachePathPrefix}
        />

        <KeyCacheItemList
          items={items}
          cachePathPrefix={cachePathPrefix}
          onUse={onUse}
          onDelete={onDelete}
        />
      </CardContent>
    </Card>
  );
}

export default KeyCachePanel;
