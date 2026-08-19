import { Badge } from "@/components/ui/badge";
import { RefreshCw, Upload } from "lucide-react";
import {
  RibbonStrip,
  RibbonDivider,
  RibbonGroup,
  RibbonButton,
  RibbonUploadButton,
  RIBBON_CONTROL,
} from "../primitives";

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
    <RibbonStrip>
      <RibbonGroup title="Import">
        <RibbonUploadButton
          icon={<Upload />}
          label="Files"
          accept=".bin,.dump,.eml,.dic,.json,.key"
          multiple
          onFiles={onCacheUpload}
        />
      </RibbonGroup>

      <RibbonDivider />

      <RibbonGroup title="Cache">
        <Badge variant="secondary" className={RIBBON_CONTROL}>
          {cacheItemsLength} files
        </Badge>
        <RibbonButton
          icon={<RefreshCw className={cacheSyncing ? "animate-spin" : undefined} />}
          label="Sync"
          onClick={onCacheSync}
          disabled={cacheSyncing}
        />
      </RibbonGroup>
    </RibbonStrip>
  );
}

export default HexTab;
