import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Upload } from "lucide-react";
import { CompactGroup } from "../primitives";

interface HexTabProps {
  cacheItemsLength: number;
  cacheSyncing?: boolean;
  onCacheUpload: (files: FileList | null) => void;
  onCacheSync: () => void;
}

export function HexTab({
  cacheItemsLength,
  cacheSyncing,
  onCacheUpload,
  onCacheSync,
}: HexTabProps) {
  return (
    <div className="flex items-start gap-3 overflow-x-auto scrollbar-hide">
      <CompactGroup title="Import">
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

      <CompactGroup title="Cache">
        <Badge variant="secondary" className="h-7 px-2 text-xs">
          {cacheItemsLength} files
        </Badge>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          onClick={onCacheSync}
          disabled={cacheSyncing}
        >
          <RefreshCw className={cacheSyncing ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
          Sync
        </Button>
      </CompactGroup>
    </div>
  );
}

export default HexTab;
