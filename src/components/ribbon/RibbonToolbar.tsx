import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  Usb,
  Radio,
  Wifi,
  CreditCard,
  Key,
  Copy,
  Play,
  Square,
  Download,
  Upload,
  Search,
  Shield,
  Settings,
  HelpCircle,
  Zap,
  Eye,
  Edit3,
  RefreshCw,
  Book,
  ListChecks,
  StopCircle,
  FileJson,
  FileCode2,
  FolderOpen,
  Layers,
  Bluetooth,
  Target,
  Wand2,
  Cpu,
  Activity,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TransportSelector } from "./TransportSelector";
import type { TransportType, TransportInfo } from "@/lib/transports";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
import type { Theme } from "@/hooks/useTheme";
import { CommandDeck } from "@/components/panels/CommandDeck";
import { CheatSheetPanel } from "@/components/panels/CheatSheetPanel";
import { KeyCachePanel, type CachedAsset } from "@/components/panels/KeyCachePanel";

interface RibbonToolbarProps {
  connectionStatus: ConnectionStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  onCommand: (cmd: string) => void;
  onStopOperation?: () => void;
  onHardReset?: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  canRunCommands?: boolean;
  cacheItems: CachedAsset[];
  cacheSyncing?: boolean;
  onCacheUpload: (files: FileList | null) => void;
  onCacheUse?: (item: CachedAsset, template: string) => void;
  onCacheDelete?: (id: string) => void;
  onCacheSync: () => void;
  cachePathPrefix?: string;
  activeTab: string;
  onTabChange: (value: string) => void;
  onJsonUpload?: (files: FileList | null) => void;
  // Transport selection (for Tauri desktop)
  availableTransports?: TransportInfo[];
  selectedTransport?: TransportType | null;
  onTransportChange?: (type: TransportType) => void;
}

interface RibbonButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "secondary" | "ghost";
}

function RibbonButton({ icon, label, onClick, disabled, variant = "ghost" }: RibbonButtonProps) {
  return (
    <Button
      variant={variant}
      size="ribbon"
      onClick={onClick}
      disabled={disabled}
      className="h-16 w-16 flex-col gap-1 text-xs"
    >
      {icon}
      <span className="text-[10px] leading-tight">{label}</span>
    </Button>
  );
}

// Compact mini button for dense layouts
interface MiniButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "secondary" | "outline" | "ghost";
}

function MiniButton({ icon, label, onClick, disabled, variant = "outline" }: MiniButtonProps) {
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="h-7 px-2 text-xs gap-1"
    >
      {icon}
      {label}
    </Button>
  );
}

function RibbonGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col">
      <div className="flex items-end gap-1 px-2 pb-1">{children}</div>
      <div className="text-[9px] text-muted-foreground text-center border-t border-border pt-1 px-2">
        {title}
      </div>
    </div>
  );
}

// Compact group for mini buttons
function CompactGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 shrink-0">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1">
        {title}
      </div>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}

// LF Card Type configurations
const LF_CARD_TYPES = [
  { value: "em4x", label: "EM4x" },
  { value: "hid", label: "HID" },
  { value: "t55xx", label: "T55xx" },
  { value: "indala", label: "Indala" },
  { value: "wiegand", label: "Wiegand" },
];

interface LFCardOperation {
  icon: string;
  label: string;
  command: string;
  variant?: "default" | "outline";
}

const LF_CARD_OPERATIONS: Record<string, LFCardOperation[]> = {
  em4x: [
    { icon: "radio", label: "Read", command: "lf em 410x reader" },
    { icon: "copy", label: "Clone", command: "lf em 410x clone" },
    { icon: "play", label: "Sim", command: "lf em 410x sim" },
  ],
  hid: [
    { icon: "creditcard", label: "Read", command: "lf hid read" },
    { icon: "copy", label: "Clone", command: "lf hid clone" },
    { icon: "play", label: "Sim", command: "lf hid sim" },
    { icon: "zap", label: "Brute", command: "lf hid brute -w H10301 -f 101" },
  ],
  t55xx: [
    { icon: "search", label: "Detect", command: "lf t55xx detect" },
    { icon: "download", label: "Dump", command: "lf t55xx dump" },
    { icon: "edit", label: "Write", command: "lf t55xx write" },
    { icon: "square", label: "Wipe", command: "lf t55xx wipe" },
  ],
  indala: [
    { icon: "radio", label: "Read", command: "lf indala read" },
    { icon: "copy", label: "Clone", command: "lf indala clone" },
    { icon: "play", label: "Sim", command: "lf indala sim" },
  ],
  wiegand: [
    { icon: "book", label: "List", command: "wiegand list" },
    { icon: "download", label: "Encode", command: "wiegand encode --fc 101 --cn 1337" },
    { icon: "upload", label: "Decode", command: "wiegand decode --raw 2006f623ae" },
  ],
};

// HF Card Type configurations
const HF_CARD_TYPES = [
  { value: "mfclassic", label: "MIFARE Classic" },
  { value: "mfultralight", label: "MIFARE Ultralight" },
  { value: "iclass", label: "iClass" },
  { value: "desfire", label: "DESFire" },
  { value: "attacks", label: "Attacks" },
];

const HF_CARD_OPERATIONS: Record<string, LFCardOperation[]> = {
  mfclassic: [
    { icon: "creditcard", label: "Info", command: "hf mf info" },
    { icon: "key", label: "Autopwn", command: "hf mf autopwn", variant: "default" },
    { icon: "download", label: "Dump", command: "hf mf dump" },
    { icon: "upload", label: "Restore", command: "hf mf restore" },
    { icon: "play", label: "Sim", command: "hf mf sim" },
  ],
  mfultralight: [
    { icon: "creditcard", label: "Info", command: "hf mfu info" },
    { icon: "download", label: "Dump", command: "hf mfu dump" },
    { icon: "play", label: "Sim", command: "hf mfu sim -t 7" },
  ],
  iclass: [
    { icon: "shield", label: "Info", command: "hf iclass info" },
    { icon: "download", label: "Dump", command: "hf iclass dump" },
    { icon: "key", label: "Keys", command: "hf iclass managekeys -p" },
    { icon: "play", label: "Sim", command: "hf iclass sim -t 3" },
  ],
  desfire: [
    { icon: "creditcard", label: "Info", command: "hf mfdes info" },
    { icon: "book", label: "List Apps", command: "hf mfdes lsapp" },
    { icon: "key", label: "Auth", command: "hf mfdes auth" },
  ],
  attacks: [
    {
      icon: "zap",
      label: "Hardnested",
      command: "hf mf hardnested --blk 0 -a -k FFFFFFFFFFFF --tblk 4 --ta -w",
    },
    { icon: "key", label: "Nested", command: "hf mf nested 1 0 a FFFFFFFFFFFF" },
    { icon: "shield", label: "Darkside", command: "hf mf darkside" },
    { icon: "listchecks", label: "Chk Keys", command: "hf mf chk --1k -f mfc_default_keys" },
  ],
};

// Icon mapper for dynamic rendering
function getIcon(iconName: string, className: string = "h-3 w-3") {
  const icons: Record<string, React.ReactNode> = {
    radio: <Radio className={className} />,
    copy: <Copy className={className} />,
    play: <Play className={className} />,
    creditcard: <CreditCard className={className} />,
    zap: <Zap className={className} />,
    search: <Search className={className} />,
    download: <Download className={className} />,
    upload: <Upload className={className} />,
    edit: <Edit3 className={className} />,
    square: <Square className={className} />,
    book: <Book className={className} />,
    key: <Key className={className} />,
    shield: <Shield className={className} />,
    listchecks: <ListChecks className={className} />,
  };
  return icons[iconName] || <Radio className={className} />;
}

export function RibbonToolbar({
  connectionStatus,
  onConnect,
  onDisconnect,
  onCommand,
  onStopOperation,
  onHardReset,
  theme,
  onThemeChange,
  canRunCommands = false,
  cacheItems,
  cacheSyncing,
  onCacheUpload,
  onCacheUse,
  onCacheDelete,
  onCacheSync,
  cachePathPrefix,
  activeTab,
  onTabChange,
  onJsonUpload,
  availableTransports = [],
  selectedTransport = null,
  onTransportChange,
}: RibbonToolbarProps) {
  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";
  const commandsEnabled = canRunCommands;
  const activeTransport = selectedTransport || availableTransports[0]?.type || null;
  const activeTransportLabel =
    availableTransports.find((transport) => transport.type === activeTransport)?.name ||
    (activeTransport === "tauri-bluetooth"
      ? "Bluetooth"
      : activeTransport === "tauri-serial"
        ? "Native Serial"
        : activeTransport === "webserial"
          ? "WebSerial"
          : "Auto Select");

  // Card type selection state
  const [selectedLFCardType, setSelectedLFCardType] = useState("em4x");
  const [selectedHFCardType, setSelectedHFCardType] = useState("mfclassic");

  return (
    <div className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <div className="border-b border-border/70">
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Workbench
                </span>
                <Badge variant="outline" className="max-w-full truncate text-[10px]">
                  {activeTransportLabel}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold tracking-tight">
                  Proxmark3 Control Surface
                </span>
                <Badge variant={isConnected ? "success" : "secondary"}>
                  {isConnected ? "Connected" : isConnecting ? "Connecting..." : "Disconnected"}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {onStopOperation && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onStopOperation}
                  disabled={!commandsEnabled}
                  className="h-7 px-3 text-xs gap-1.5"
                  title="Send Ctrl+C to stop current operation"
                >
                  <StopCircle className="h-3.5 w-3.5" />
                  Stop
                </Button>
              )}
              {onHardReset && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onHardReset}
                  className="h-7 px-2 text-xs gap-1 text-orange-600 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-950"
                  title="Force reload if stuck (will disconnect)"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reset
                </Button>
              )}
              <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
            </div>
          </div>

          <div className="relative border-t border-border/60">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-card via-card/85 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-card via-card/85 to-transparent" />
            <div className="overflow-x-auto scrollbar-hide px-2 py-2">
              <TabsList className="h-auto min-w-max gap-1 bg-transparent p-0">
                <TabsTrigger
                  value="connect"
                  className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs data-[state=active]:border-border data-[state=active]:bg-background/80"
                >
                  Connect
                </TabsTrigger>
                <TabsTrigger
                  value="hf"
                  className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs data-[state=active]:border-border data-[state=active]:bg-background/80"
                >
                  HF
                </TabsTrigger>
                <TabsTrigger
                  value="lf"
                  className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs data-[state=active]:border-border data-[state=active]:bg-background/80"
                >
                  LF
                </TabsTrigger>
                <TabsTrigger
                  value="data"
                  className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs data-[state=active]:border-border data-[state=active]:bg-background/80"
                >
                  Data
                </TabsTrigger>
                <TabsTrigger
                  value="tools"
                  className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs data-[state=active]:border-border data-[state=active]:bg-background/80"
                >
                  Tools
                </TabsTrigger>
                <TabsTrigger
                  value="actions"
                  className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs data-[state=active]:border-border data-[state=active]:bg-background/80"
                >
                  Shortcuts
                </TabsTrigger>
                <Separator orientation="vertical" className="mx-1 h-5 shrink-0" />
                <TabsTrigger
                  value="attacks"
                  className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs gap-1 data-[state=active]:border-border data-[state=active]:bg-background/80"
                >
                  <Target className="h-3 w-3" />
                  Attacks
                </TabsTrigger>
                <TabsTrigger
                  value="magic"
                  className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs gap-1 data-[state=active]:border-border data-[state=active]:bg-background/80"
                >
                  <Wand2 className="h-3 w-3" />
                  Magic
                </TabsTrigger>
                <TabsTrigger
                  value="traffic"
                  className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs gap-1 data-[state=active]:border-border data-[state=active]:bg-background/80"
                >
                  <Activity className="h-3 w-3" />
                  Traffic
                </TabsTrigger>
                <Separator orientation="vertical" className="mx-1 h-5 shrink-0" />
                <TabsTrigger
                  value="lfops"
                  className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs gap-1 data-[state=active]:border-border data-[state=active]:bg-background/80"
                >
                  <Radio className="h-3 w-3" />
                  LF Ops
                </TabsTrigger>
                <TabsTrigger
                  value="t55xx"
                  className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs gap-1 data-[state=active]:border-border data-[state=active]:bg-background/80"
                >
                  <Cpu className="h-3 w-3" />
                  T55xx
                </TabsTrigger>
                <Separator orientation="vertical" className="mx-1 h-5 shrink-0" />
                <TabsTrigger
                  value="memory"
                  className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs gap-1 data-[state=active]:border-border data-[state=active]:bg-background/80"
                >
                  <Layers className="h-3 w-3" />
                  Memory
                </TabsTrigger>
                <TabsTrigger
                  value="hex"
                  className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs gap-1 data-[state=active]:border-border data-[state=active]:bg-background/80"
                >
                  <FileCode2 className="h-3 w-3" />
                  Hex
                </TabsTrigger>
                <TabsTrigger
                  value="library"
                  className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs gap-1 data-[state=active]:border-border data-[state=active]:bg-background/80"
                >
                  <Book className="h-3 w-3" />
                  Library
                </TabsTrigger>
                <TabsTrigger
                  value="utilities"
                  className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs gap-1 data-[state=active]:border-border data-[state=active]:bg-background/80"
                >
                  <Cpu className="h-3 w-3" />
                  Utilities
                </TabsTrigger>
                <TabsTrigger
                  value="settings"
                  className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs gap-1 data-[state=active]:border-border data-[state=active]:bg-background/80"
                >
                  <Settings className="h-3 w-3" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
        </div>

        {/* Connect Tab */}
        <TabsContent value="connect" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-start gap-2 overflow-x-auto scrollbar-hide">
            <RibbonGroup title="Connection">
              <RibbonButton
                icon={
                  selectedTransport === "tauri-bluetooth" ? (
                    <Bluetooth className={isConnected ? "text-blue-500" : ""} />
                  ) : (
                    <Usb className={isConnected ? "text-green-500" : ""} />
                  )
                }
                label={isConnected ? "Disconnect" : "Connect"}
                onClick={isConnected ? onDisconnect : onConnect}
                variant={isConnected ? "secondary" : "default"}
              />
              <RibbonButton
                icon={<RefreshCw />}
                label="Reconnect"
                onClick={() => {
                  onDisconnect();
                  setTimeout(onConnect, 500);
                }}
                disabled={!commandsEnabled}
              />
            </RibbonGroup>

            {/* Transport Selector - only shown when multiple transports available */}
            {availableTransports.length > 1 && onTransportChange && (
              <>
                <Separator orientation="vertical" className="h-16 shrink-0" />
                <TransportSelector
                  availableTransports={availableTransports}
                  selectedTransport={selectedTransport}
                  onTransportChange={onTransportChange}
                  disabled={isConnecting}
                  isConnected={isConnected}
                />
              </>
            )}

            <Separator orientation="vertical" className="h-16 shrink-0" />

            <RibbonGroup title="Device">
              <RibbonButton
                icon={<HelpCircle />}
                label="Info"
                onClick={() => onCommand("hw version")}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Zap />}
                label="Tune"
                onClick={() => onCommand("hw tune")}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Settings />}
                label="Status"
                onClick={() => onCommand("hw status")}
                disabled={!commandsEnabled}
              />
            </RibbonGroup>
          </div>
        </TabsContent>

        {/* HF Tab - Card Type Dropdown */}
        <TabsContent value="hf" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            {/* Search - Always visible (can detect card type) */}
            <CompactGroup title="Search">
              <MiniButton
                icon={<Search className="h-3 w-3" />}
                label="Search"
                onClick={() => onCommand("hf search")}
                disabled={!commandsEnabled}
                variant="default"
              />
              <MiniButton
                icon={<Radio className="h-3 w-3" />}
                label="14A Info"
                onClick={() => onCommand("hf 14a info")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Eye className="h-3 w-3" />}
                label="Sniff"
                onClick={() => onCommand("hf sniff")}
                disabled={!commandsEnabled}
              />
            </CompactGroup>

            <Separator orientation="vertical" className="h-14 shrink-0" />

            {/* Card Type Selector */}
            <div className="flex flex-col gap-1 shrink-0">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1">
                Card Type
              </div>
              <Select
                value={selectedHFCardType}
                onValueChange={setSelectedHFCardType}
                options={HF_CARD_TYPES}
                className="w-40"
              />
            </div>

            <Separator orientation="vertical" className="h-14 shrink-0" />

            {/* Dynamic Operations based on selected card type */}
            <CompactGroup
              title={
                HF_CARD_TYPES.find((c) => c.value === selectedHFCardType)?.label || "Operations"
              }
            >
              {HF_CARD_OPERATIONS[selectedHFCardType]?.map((op) => (
                <MiniButton
                  key={op.label}
                  icon={getIcon(op.icon)}
                  label={op.label}
                  onClick={() => onCommand(op.command)}
                  disabled={!commandsEnabled}
                  variant={op.variant || "outline"}
                />
              ))}
            </CompactGroup>
          </div>
        </TabsContent>

        {/* LF Tab - Card Type Dropdown */}
        <TabsContent value="lf" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            {/* Search - Always visible (can detect card type) */}
            <CompactGroup title="Search">
              <MiniButton
                icon={<Search className="h-3 w-3" />}
                label="Search"
                onClick={() => onCommand("lf search")}
                disabled={!commandsEnabled}
                variant="default"
              />
              <MiniButton
                icon={<Wifi className="h-3 w-3" />}
                label="Read"
                onClick={() => onCommand("lf read")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Eye className="h-3 w-3" />}
                label="Sniff"
                onClick={() => onCommand("lf sniff")}
                disabled={!commandsEnabled}
              />
            </CompactGroup>

            <Separator orientation="vertical" className="h-14 shrink-0" />

            {/* Card Type Selector */}
            <div className="flex flex-col gap-1 shrink-0">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1">
                Card Type
              </div>
              <Select
                value={selectedLFCardType}
                onValueChange={setSelectedLFCardType}
                options={LF_CARD_TYPES}
                className="w-32"
              />
            </div>

            <Separator orientation="vertical" className="h-14 shrink-0" />

            {/* Dynamic Operations based on selected card type */}
            <CompactGroup
              title={
                LF_CARD_TYPES.find((c) => c.value === selectedLFCardType)?.label || "Operations"
              }
            >
              {LF_CARD_OPERATIONS[selectedLFCardType]?.map((op) => (
                <MiniButton
                  key={op.label}
                  icon={getIcon(op.icon)}
                  label={op.label}
                  onClick={() => onCommand(op.command)}
                  disabled={!commandsEnabled}
                  variant={op.variant || "outline"}
                />
              ))}
            </CompactGroup>
          </div>
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-start gap-2 overflow-x-auto scrollbar-hide">
            <RibbonGroup title="Capture">
              <RibbonButton
                icon={<Search />}
                label="Samples"
                onClick={() => onCommand("data samples -n 40000")}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Download />}
                label="Save"
                onClick={() => onCommand("data save -f trace.bin")}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Upload />}
                label="Load"
                onClick={() => onCommand("data load -f trace.bin")}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Square />}
                label="Clear"
                onClick={() => onCommand("data clear")}
                disabled={!commandsEnabled}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16 shrink-0" />

            <RibbonGroup title="Analysis">
              <RibbonButton
                icon={<Search />}
                label="Autocorr"
                onClick={() => onCommand("data autocorr")}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Zap />}
                label="Detect Clk"
                onClick={() => onCommand("data detectclock")}
                disabled={!commandsEnabled}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16 shrink-0" />

            <RibbonGroup title="Convert">
              <RibbonButton
                icon={<Download />}
                label="bin→eml"
                onClick={() => onCommand("script run data_mf_bin2eml -h")}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Upload />}
                label="eml→bin"
                onClick={() => onCommand("script run data_mf_eml2bin -h")}
                disabled={!commandsEnabled}
              />
            </RibbonGroup>
          </div>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-start gap-2 overflow-x-auto scrollbar-hide">
            <RibbonGroup title="Scripts">
              <RibbonButton
                icon={<Play />}
                label="List Scripts"
                onClick={() => onCommand("script list")}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Play />}
                label="UID Bruteforce"
                onClick={() => onCommand("script run hf_mf_uidbruteforce -h")}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Play />}
                label="Format Card"
                onClick={() => onCommand("script run hf_mf_format -h")}
                disabled={!commandsEnabled}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16 shrink-0" />

            <RibbonGroup title="Key Memory">
              <RibbonButton
                icon={<Key />}
                label="Load MFC"
                onClick={() => onCommand("mem load -f mfc_default_keys --mfc")}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Key />}
                label="Load iClass"
                onClick={() => onCommand("mem load -f iclass_default_keys --iclass")}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Key />}
                label="Load T55xx"
                onClick={() => onCommand("mem load -f t55xx_default_pwds --t55xx")}
                disabled={!commandsEnabled}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16 shrink-0" />

            <RibbonGroup title="Help">
              <RibbonButton
                icon={<HelpCircle />}
                label="Help"
                onClick={() => onCommand("help")}
                disabled={false}
              />
              <RibbonButton
                icon={<Settings />}
                label="Prefs"
                onClick={() => onCommand("prefs show")}
                disabled={!commandsEnabled}
              />
            </RibbonGroup>
          </div>
        </TabsContent>

        {/* Shortcuts Tab (full panels) */}
        <TabsContent value="actions" className="m-0 p-2 ribbon-tab-content">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
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
        </TabsContent>

        {/* Memory Editor Tab */}
        <TabsContent value="memory" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-start gap-3 overflow-x-auto scrollbar-hide">
            <CompactGroup title="Import">
              <Button
                variant="default"
                size="sm"
                className="h-7 px-2 text-xs gap-1 relative overflow-hidden"
              >
                <FileJson className="h-3 w-3" />
                JSON Dump
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    onJsonUpload?.(e.target.files);
                    e.target.value = "";
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1 relative overflow-hidden"
              >
                <FolderOpen className="h-3 w-3" />
                Folder
                <input
                  type="file"
                  // @ts-expect-error webkitdirectory is not standard
                  webkitdirectory=""
                  multiple
                  onChange={(e) => {
                    onCacheUpload(e.target.files);
                    e.target.value = "";
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1 relative overflow-hidden"
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
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </Button>
            </CompactGroup>

            <Separator orientation="vertical" className="h-14 shrink-0" />

            <CompactGroup title="Card Operations">
              <MiniButton
                icon={<Key className="h-3 w-3" />}
                label="Autopwn"
                onClick={() => onCommand("hf mf autopwn --1k")}
                disabled={!commandsEnabled}
                variant="default"
              />
              <MiniButton
                icon={<Download className="h-3 w-3" />}
                label="Dump"
                onClick={() => onCommand("hf mf dump")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Upload className="h-3 w-3" />}
                label="Restore"
                onClick={() => onCommand("hf mf restore")}
                disabled={!commandsEnabled}
              />
            </CompactGroup>

            <Separator orientation="vertical" className="h-14 shrink-0" />

            <CompactGroup title="Emulator">
              <MiniButton
                icon={<Download className="h-3 w-3" />}
                label="Load"
                onClick={() => onCommand("hf mf eload")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Upload className="h-3 w-3" />}
                label="Save"
                onClick={() => onCommand("hf mf esave")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Play className="h-3 w-3" />}
                label="Simulate"
                onClick={() => onCommand("hf mf sim --1k")}
                disabled={!commandsEnabled}
              />
            </CompactGroup>

            <Separator orientation="vertical" className="h-14 shrink-0" />

            <CompactGroup title="Cache">
              <MiniButton
                icon={<RefreshCw className={cacheSyncing ? "h-3 w-3 animate-spin" : "h-3 w-3"} />}
                label="Sync"
                onClick={onCacheSync}
                disabled={!commandsEnabled || cacheSyncing}
              />
              <Badge variant="secondary" className="h-7 px-2 text-xs">
                {cacheItems.length} files
              </Badge>
            </CompactGroup>
          </div>
        </TabsContent>

        {/* Hex Tab */}
        <TabsContent value="hex" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-start gap-3 overflow-x-auto scrollbar-hide">
            <CompactGroup title="Import">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1 relative overflow-hidden"
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
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </Button>
            </CompactGroup>

            <Separator orientation="vertical" className="h-14 shrink-0" />

            <CompactGroup title="Cache">
              <Badge variant="secondary" className="h-7 px-2 text-xs">
                {cacheItems.length} files
              </Badge>
              <MiniButton
                icon={<RefreshCw className={cacheSyncing ? "h-3 w-3 animate-spin" : "h-3 w-3"} />}
                label="Sync"
                onClick={onCacheSync}
                disabled={!commandsEnabled || cacheSyncing}
              />
            </CompactGroup>
          </div>
        </TabsContent>

        {/* Library Tab */}
        <TabsContent value="library" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <CompactGroup title="Library">
              <MiniButton
                icon={<FolderOpen className="h-3 w-3" />}
                label="Memory"
                onClick={() => onTabChange("memory")}
                variant="default"
              />
              <Badge variant="secondary" className="h-7 px-2 text-xs">
                Local browser vault
              </Badge>
            </CompactGroup>
            <Separator orientation="vertical" className="h-14 shrink-0" />
            <div className="text-xs text-muted-foreground">
              Save cards, organize keys, and annotate cached dumps without leaving the browser.
            </div>
          </div>
        </TabsContent>

        {/* Utilities Tab */}
        <TabsContent value="utilities" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <CompactGroup title="Utilities">
              <MiniButton
                icon={<FileCode2 className="h-3 w-3" />}
                label="Hex"
                onClick={() => onTabChange("hex")}
                variant="outline"
              />
              <Badge variant="secondary" className="h-7 px-2 text-xs">
                Offline calculators
              </Badge>
            </CompactGroup>
            <Separator orientation="vertical" className="h-14 shrink-0" />
            <div className="text-xs text-muted-foreground">
              APDU, PN532, UID, and checksum helpers run locally with no external services.
            </div>
          </div>
        </TabsContent>

        {/* Attacks Tab - Panel-based, minimal ribbon */}
        <TabsContent value="attacks" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <CompactGroup title="Quick Attacks">
              <MiniButton
                icon={<Zap className="h-3 w-3" />}
                label="Autopwn 1K"
                onClick={() => onCommand("hf mf autopwn --1k")}
                disabled={!commandsEnabled}
                variant="default"
              />
              <MiniButton
                icon={<Zap className="h-3 w-3" />}
                label="Autopwn 4K"
                onClick={() => onCommand("hf mf autopwn --4k")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Shield className="h-3 w-3" />}
                label="Darkside"
                onClick={() => onCommand("hf mf darkside")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Key className="h-3 w-3" />}
                label="Check Keys"
                onClick={() => onCommand("hf mf chk --1k")}
                disabled={!commandsEnabled}
              />
            </CompactGroup>
            <Separator orientation="vertical" className="h-14 shrink-0" />
            <div className="text-xs text-muted-foreground">
              Use the panel below for advanced attack configuration
            </div>
          </div>
        </TabsContent>

        {/* Magic Card Tab */}
        <TabsContent value="magic" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <CompactGroup title="Detect">
              <MiniButton
                icon={<Search className="h-3 w-3" />}
                label="Info"
                onClick={() => onCommand("hf mf info")}
                disabled={!commandsEnabled}
                variant="default"
              />
              <MiniButton
                icon={<CreditCard className="h-3 w-3" />}
                label="Gen1 Test"
                onClick={() => onCommand("hf 14a raw -a -k -b 7 40")}
                disabled={!commandsEnabled}
              />
            </CompactGroup>
            <Separator orientation="vertical" className="h-14 shrink-0" />
            <CompactGroup title="Operations">
              <MiniButton
                icon={<Wand2 className="h-3 w-3" />}
                label="View"
                onClick={() => onCommand("hf mf cview")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Download className="h-3 w-3" />}
                label="Dump"
                onClick={() => onCommand("hf mf dump")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Square className="h-3 w-3" />}
                label="Wipe"
                onClick={() => onCommand("hf mf cwipe")}
                disabled={!commandsEnabled}
              />
            </CompactGroup>
            <Separator orientation="vertical" className="h-14 shrink-0" />
            <div className="text-xs text-muted-foreground">
              Use the panel below for UID write and Block 0 operations
            </div>
          </div>
        </TabsContent>

        {/* Traffic Capture Tab */}
        <TabsContent value="traffic" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <CompactGroup title="HF Sniff">
              <MiniButton
                icon={<Radio className="h-3 w-3" />}
                label="14A Sniff"
                onClick={() => onCommand("hf 14a sniff -c -r")}
                disabled={!commandsEnabled}
                variant="default"
              />
              <MiniButton
                icon={<Shield className="h-3 w-3" />}
                label="iCLASS"
                onClick={() => onCommand("hf iclass sniff")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Radio className="h-3 w-3" />}
                label="15693"
                onClick={() => onCommand("hf 15 sniff")}
                disabled={!commandsEnabled}
              />
            </CompactGroup>
            <Separator orientation="vertical" className="h-14 shrink-0" />
            <CompactGroup title="Trace">
              <MiniButton
                icon={<ListChecks className="h-3 w-3" />}
                label="List 14A"
                onClick={() => onCommand("trace list -t 14a -1")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<ListChecks className="h-3 w-3" />}
                label="List iClass"
                onClick={() => onCommand("trace list -t iclass -1")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Square className="h-3 w-3" />}
                label="Clear"
                onClick={() => onCommand("trace clear")}
                disabled={!commandsEnabled}
              />
            </CompactGroup>
            <Separator orientation="vertical" className="h-14 shrink-0" />
            <div className="text-xs text-muted-foreground">
              Use the panel below for capture analysis
            </div>
          </div>
        </TabsContent>

        {/* LF Operations Tab */}
        <TabsContent value="lfops" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <CompactGroup title="Basic">
              <MiniButton
                icon={<Search className="h-3 w-3" />}
                label="Search"
                onClick={() => onCommand("lf search")}
                disabled={!commandsEnabled}
                variant="default"
              />
              <MiniButton
                icon={<Zap className="h-3 w-3" />}
                label="Tune"
                onClick={() => onCommand("hw tune --lf")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Download className="h-3 w-3" />}
                label="Read"
                onClick={() => onCommand("lf read -s 40000")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Eye className="h-3 w-3" />}
                label="Sniff"
                onClick={() => onCommand("lf sniff")}
                disabled={!commandsEnabled}
              />
            </CompactGroup>
            <Separator orientation="vertical" className="h-14 shrink-0" />
            <CompactGroup title="Config">
              <MiniButton
                icon={<Settings className="h-3 w-3" />}
                label="Status"
                onClick={() => onCommand("hw status")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Radio className="h-3 w-3" />}
                label="125kHz"
                onClick={() => onCommand("lf config -d 95")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Radio className="h-3 w-3" />}
                label="134kHz"
                onClick={() => onCommand("lf config -d 88")}
                disabled={!commandsEnabled}
              />
            </CompactGroup>
            <Separator orientation="vertical" className="h-14 shrink-0" />
            <div className="text-xs text-muted-foreground">
              Use the panel below for advanced frequency config
            </div>
          </div>
        </TabsContent>

        {/* T55xx Tab */}
        <TabsContent value="t55xx" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <CompactGroup title="T55xx">
              <MiniButton
                icon={<Search className="h-3 w-3" />}
                label="Detect"
                onClick={() => onCommand("lf t55xx detect")}
                disabled={!commandsEnabled}
                variant="default"
              />
              <MiniButton
                icon={<Download className="h-3 w-3" />}
                label="Dump"
                onClick={() => onCommand("lf t55xx dump")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Square className="h-3 w-3" />}
                label="Wipe"
                onClick={() => onCommand("lf t55xx wipe")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Key className="h-3 w-3" />}
                label="Chk Pwd"
                onClick={() => onCommand("lf t55xx chk")}
                disabled={!commandsEnabled}
              />
            </CompactGroup>
            <Separator orientation="vertical" className="h-14 shrink-0" />
            <CompactGroup title="EM410x">
              <MiniButton
                icon={<Radio className="h-3 w-3" />}
                label="Read"
                onClick={() => onCommand("lf em 410x reader")}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Copy className="h-3 w-3" />}
                label="Clone"
                onClick={() => onCommand("lf em 410x clone --id 0102030405")}
                disabled={!commandsEnabled}
              />
            </CompactGroup>
            <Separator orientation="vertical" className="h-14 shrink-0" />
            <div className="text-xs text-muted-foreground">
              Use the panel below for detailed operations
            </div>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <div className="text-xs text-muted-foreground">
              Configure application settings, preferences, and data management in the panel below.
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RibbonToolbar;
