import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { kindConfig } from "../config";
import type { CachedAsset } from "../types";
import { formatTemplate, prettySize, resolveCachePath, relativeTime } from "../utils";

interface KeyCacheItemCardProps {
  item: CachedAsset;
  cachePathPrefix: string;
  onUse: (item: CachedAsset, template: string) => void;
  onDelete: (id: string) => void;
}

export function KeyCacheItemCard({
  item,
  cachePathPrefix,
  onUse,
  onDelete,
}: KeyCacheItemCardProps) {
  const config = kindConfig[item.kind];
  const cachePath = resolveCachePath(cachePathPrefix, item.name, item.relativePath);
  const displayName = item.relativePath || item.name;

  return (
    <div className="rounded-lg border px-3 py-2 bg-card/50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant={config.variant}>
            <config.icon className="mr-1 h-3 w-3" />
            {config.label}
          </Badge>
          <span className="max-w-[160px] truncate text-sm font-medium" title={displayName}>
            {displayName}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{prettySize(item.size)}</span>
          <span>•</span>
          <span>{relativeTime(item.updatedAt)}</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(item.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {config.commandTemplates.map((template) => (
          <Button
            key={template}
            size="sm"
            variant="outline"
            className="text-[11px]"
            onClick={() => onUse(item, template)}
          >
            {formatTemplate(template, cachePath)}
          </Button>
        ))}
      </div>
    </div>
  );
}
