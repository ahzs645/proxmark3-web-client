import type { Theme } from "@/hooks/useTheme";
import type { TransportInfo, TransportType } from "@/lib/transports";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface RibbonToolbarProps {
  connectionStatus: ConnectionStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  onCommand: (cmd: string) => void;
  onStopOperation?: () => void;
  onHardReset?: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  canRunCommands?: boolean;
  cacheItems: import("@/components/panels/KeyCachePanel").CachedAsset[];
  cacheSyncing?: boolean;
  onCacheUpload: (files: FileList | null) => void;
  onCacheUse: (
    item: import("@/components/panels/KeyCachePanel").CachedAsset,
    template: string,
  ) => void;
  onCacheDelete: (id: string) => void;
  onCacheSync: () => void;
  cachePathPrefix?: string;
  activeTab: string;
  onTabChange: (value: string) => void;
  onJsonUpload?: (files: FileList | null) => void;
  availableTransports?: TransportInfo[];
  selectedTransport?: TransportType | null;
  onTransportChange?: (type: TransportType) => void;
}
