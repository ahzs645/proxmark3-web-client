import { KeyCachePanel, type CachedAsset } from "@/components/panels/KeyCachePanel";
import { CheatSheetPanel } from "@/components/panels/CheatSheetPanel";
import { CommandDeck } from "@/components/panels/CommandDeck";

interface ActionsTabProps {
  canRunCommands: boolean;
  cacheItems: CachedAsset[];
  cacheSyncing?: boolean;
  onCacheUpload: (files: FileList | null) => void;
  onCacheUse?: (item: CachedAsset, template: string) => void;
  onCacheDelete?: (id: string) => void;
  onCacheSync: () => void;
  cachePathPrefix?: string;
  onCommand: (cmd: string) => void;
}

export function ActionsTab({
  canRunCommands,
  cacheItems,
  cacheSyncing,
  onCacheUpload,
  onCacheUse,
  onCacheDelete,
  onCacheSync,
  cachePathPrefix,
  onCommand,
}: ActionsTabProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        <CommandDeck onRun={onCommand} disabled={!canRunCommands} />
        <CheatSheetPanel onRun={onCommand} disabled={!canRunCommands} />
      </div>
      <div className="mt-2">
        <KeyCachePanel
          items={cacheItems}
          onUpload={onCacheUpload}
          onUse={onCacheUse!}
          onDelete={onCacheDelete!}
          onSync={onCacheSync}
          syncing={cacheSyncing}
          cachePathPrefix={cachePathPrefix}
        />
      </div>
    </>
  );
}

export default ActionsTab;
