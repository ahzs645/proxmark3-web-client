import type { ConnectionState } from "@/features/connection/model";
import type { Theme } from "@/hooks/useTheme";
import type { TransportInfo, TransportType } from "@/lib/transports";
import type { RibbonStripId } from "./config";
import type { LibraryKeyMode } from "@/features/keys/libraryKeyCommands";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface RibbonToolbarProps {
  /** The single derived connection state (runtime → transport → client). */
  connection: ConnectionState;
  onConnect: () => void;
  onDisconnect: () => void;
  onCommand: (cmd: string) => void;
  libraryKeyMode: LibraryKeyMode;
  onLibraryKeyModeChange: (mode: LibraryKeyMode) => void;
  onStopOperation?: () => void;
  onHardReset?: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  /** A command is currently executing. */
  isBusy: boolean;
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
  /** Which panel is open. */
  activeWorkspace: string;
  onWorkspaceChange: (value: string) => void;
  /** Which command strip the ribbon is showing (does not affect the panel). */
  activeStrip: RibbonStripId;
  onStripChange: (strip: RibbonStripId) => void;
  onJsonUpload?: (files: FileList | null) => void;
  availableTransports?: TransportInfo[];
  selectedTransport?: TransportType | null;
  onTransportChange?: (type: TransportType) => void;
}
