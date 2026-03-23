import { KeyCacheEmptyState } from "./KeyCacheEmptyState";
import { KeyCacheItemCard } from "./KeyCacheItemCard";
import type { CachedAsset } from "../types";

interface KeyCacheItemListProps {
  items: CachedAsset[];
  cachePathPrefix: string;
  onUse: (item: CachedAsset, template: string) => void;
  onDelete: (id: string) => void;
}

export function KeyCacheItemList({
  items,
  cachePathPrefix,
  onUse,
  onDelete,
}: KeyCacheItemListProps) {
  const sortedItems = [...items].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="space-y-3">
      {sortedItems.length === 0 ? <KeyCacheEmptyState /> : null}

      <div className="max-h-80 space-y-2 overflow-auto pr-1">
        {sortedItems.map((item) => (
          <KeyCacheItemCard
            key={item.id}
            item={item}
            cachePathPrefix={cachePathPrefix}
            onUse={onUse}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
