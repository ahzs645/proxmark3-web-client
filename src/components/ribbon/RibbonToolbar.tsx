import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
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
  Grid3X3,
  Layers,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
import type { Theme } from '@/hooks/useTheme';
import { CommandDeck } from '@/components/panels/CommandDeck';
import { CheatSheetPanel } from '@/components/panels/CheatSheetPanel';
import { KeyCachePanel, type CachedAsset } from '@/components/panels/KeyCachePanel';

interface RibbonToolbarProps {
  connectionStatus: ConnectionStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  onCommand: (cmd: string) => void;
  onStopOperation?: () => void;
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
}

interface RibbonButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'secondary' | 'ghost';
}

function RibbonButton({ icon, label, onClick, disabled, variant = 'ghost' }: RibbonButtonProps) {
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
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
}

function MiniButton({ icon, label, onClick, disabled, variant = 'outline' }: MiniButtonProps) {
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
    <div className="flex flex-col">
      <div className="flex items-end gap-1 px-2 pb-1">
        {children}
      </div>
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
      <div className="flex gap-1">
        {children}
      </div>
    </div>
  );
}

// LF Card Type configurations
const LF_CARD_TYPES = [
  { value: 'em4x', label: 'EM4x' },
  { value: 'hid', label: 'HID' },
  { value: 't55xx', label: 'T55xx' },
  { value: 'indala', label: 'Indala' },
  { value: 'wiegand', label: 'Wiegand' },
];

interface LFCardOperation {
  icon: string;
  label: string;
  command: string;
  variant?: 'default' | 'outline';
}

const LF_CARD_OPERATIONS: Record<string, LFCardOperation[]> = {
  em4x: [
    { icon: 'radio', label: 'Read', command: 'lf em 410x reader' },
    { icon: 'copy', label: 'Clone', command: 'lf em 410x clone' },
    { icon: 'play', label: 'Sim', command: 'lf em 410x sim' },
  ],
  hid: [
    { icon: 'creditcard', label: 'Read', command: 'lf hid read' },
    { icon: 'copy', label: 'Clone', command: 'lf hid clone' },
    { icon: 'play', label: 'Sim', command: 'lf hid sim' },
    { icon: 'zap', label: 'Brute', command: 'lf hid brute -w H10301 -f 101' },
  ],
  t55xx: [
    { icon: 'search', label: 'Detect', command: 'lf t55xx detect' },
    { icon: 'download', label: 'Dump', command: 'lf t55xx dump' },
    { icon: 'edit', label: 'Write', command: 'lf t55xx write' },
    { icon: 'square', label: 'Wipe', command: 'lf t55xx wipe' },
  ],
  indala: [
    { icon: 'radio', label: 'Read', command: 'lf indala read' },
    { icon: 'copy', label: 'Clone', command: 'lf indala clone' },
    { icon: 'play', label: 'Sim', command: 'lf indala sim' },
  ],
  wiegand: [
    { icon: 'book', label: 'List', command: 'wiegand list' },
    { icon: 'download', label: 'Encode', command: 'wiegand encode --fc 101 --cn 1337' },
    { icon: 'upload', label: 'Decode', command: 'wiegand decode --raw 2006f623ae' },
  ],
};

// HF Card Type configurations
const HF_CARD_TYPES = [
  { value: 'mfclassic', label: 'MIFARE Classic' },
  { value: 'mfultralight', label: 'MIFARE Ultralight' },
  { value: 'iclass', label: 'iClass' },
  { value: 'desfire', label: 'DESFire' },
  { value: 'attacks', label: 'Attacks' },
];

const HF_CARD_OPERATIONS: Record<string, LFCardOperation[]> = {
  mfclassic: [
    { icon: 'creditcard', label: 'Info', command: 'hf mf info' },
    { icon: 'key', label: 'Autopwn', command: 'hf mf autopwn', variant: 'default' },
    { icon: 'download', label: 'Dump', command: 'hf mf dump' },
    { icon: 'upload', label: 'Restore', command: 'hf mf restore' },
    { icon: 'play', label: 'Sim', command: 'hf mf sim' },
  ],
  mfultralight: [
    { icon: 'creditcard', label: 'Info', command: 'hf mfu info' },
    { icon: 'download', label: 'Dump', command: 'hf mfu dump' },
    { icon: 'play', label: 'Sim', command: 'hf mfu sim -t 7' },
  ],
  iclass: [
    { icon: 'shield', label: 'Info', command: 'hf iclass info' },
    { icon: 'download', label: 'Dump', command: 'hf iclass dump' },
    { icon: 'key', label: 'Keys', command: 'hf iclass managekeys -p' },
    { icon: 'play', label: 'Sim', command: 'hf iclass sim -t 3' },
  ],
  desfire: [
    { icon: 'creditcard', label: 'Info', command: 'hf mfdes info' },
    { icon: 'book', label: 'List Apps', command: 'hf mfdes lsapp' },
    { icon: 'key', label: 'Auth', command: 'hf mfdes auth' },
  ],
  attacks: [
    { icon: 'zap', label: 'Hardnested', command: 'hf mf hardnested --blk 0 -a -k FFFFFFFFFFFF --tblk 4 --ta -w' },
    { icon: 'key', label: 'Nested', command: 'hf mf nested 1 0 a FFFFFFFFFFFF' },
    { icon: 'shield', label: 'Darkside', command: 'hf mf darkside' },
    { icon: 'listchecks', label: 'Chk Keys', command: 'hf mf chk --1k -f mfc_default_keys' },
  ],
};

// Icon mapper for dynamic rendering
function getIcon(iconName: string, className: string = 'h-3 w-3') {
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
}: RibbonToolbarProps) {
  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';
  const commandsEnabled = canRunCommands;

  // Card type selection state
  const [selectedLFCardType, setSelectedLFCardType] = useState('em4x');
  const [selectedHFCardType, setSelectedHFCardType] = useState('mfclassic');

  return (
    <div className="border-b border-border bg-card sticky top-0 z-50">
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <div className="flex items-center px-2 border-b border-border">
          <TabsList className="h-9 bg-transparent">
            <TabsTrigger value="connect" className="text-xs">Connect</TabsTrigger>
            <TabsTrigger value="hf" className="text-xs">HF</TabsTrigger>
            <TabsTrigger value="lf" className="text-xs">LF</TabsTrigger>
            <TabsTrigger value="data" className="text-xs">Data</TabsTrigger>
            <TabsTrigger value="tools" className="text-xs">Tools</TabsTrigger>
            <TabsTrigger value="actions" className="text-xs">Shortcuts</TabsTrigger>
            <Separator orientation="vertical" className="h-5 mx-1" />
            <TabsTrigger value="memory" className="text-xs gap-1">
              <Layers className="h-3 w-3" />
              Memory Editor
            </TabsTrigger>
            <TabsTrigger value="hex" className="text-xs gap-1">
              <FileCode2 className="h-3 w-3" />
              Hex Viewer
            </TabsTrigger>
          </TabsList>

          <div className="ml-auto flex items-center gap-2 pr-2">
            {/* Stop Operation Button - Always visible when commands can run */}
            {onStopOperation && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onStopOperation}
                disabled={!commandsEnabled}
                className="h-7 px-3 text-xs gap-1.5"
              >
                <StopCircle className="h-3.5 w-3.5" />
                Stop
              </Button>
            )}
            <Badge variant={isConnected ? 'success' : 'secondary'}>
              {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
            </Badge>
            <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
          </div>
        </div>

        {/* Connect Tab */}
        <TabsContent value="connect" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-start gap-2">
            <RibbonGroup title="Connection">
              <RibbonButton
                icon={<Usb className={isConnected ? 'text-green-500' : ''} />}
                label={isConnected ? 'Disconnect' : 'Connect'}
                onClick={isConnected ? onDisconnect : onConnect}
                variant={isConnected ? 'secondary' : 'default'}
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

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="Device">
              <RibbonButton
                icon={<HelpCircle />}
                label="Info"
                onClick={() => onCommand('hw version')}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Zap />}
                label="Tune"
                onClick={() => onCommand('hw tune')}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Settings />}
                label="Status"
                onClick={() => onCommand('hw status')}
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
              <MiniButton icon={<Search className="h-3 w-3" />} label="Search" onClick={() => onCommand('hf search')} disabled={!commandsEnabled} variant="default" />
              <MiniButton icon={<Radio className="h-3 w-3" />} label="14A Info" onClick={() => onCommand('hf 14a info')} disabled={!commandsEnabled} />
              <MiniButton icon={<Eye className="h-3 w-3" />} label="Sniff" onClick={() => onCommand('hf sniff')} disabled={!commandsEnabled} />
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
            <CompactGroup title={HF_CARD_TYPES.find(c => c.value === selectedHFCardType)?.label || 'Operations'}>
              {HF_CARD_OPERATIONS[selectedHFCardType]?.map((op) => (
                <MiniButton
                  key={op.label}
                  icon={getIcon(op.icon)}
                  label={op.label}
                  onClick={() => onCommand(op.command)}
                  disabled={!commandsEnabled}
                  variant={op.variant || 'outline'}
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
              <MiniButton icon={<Search className="h-3 w-3" />} label="Search" onClick={() => onCommand('lf search')} disabled={!commandsEnabled} variant="default" />
              <MiniButton icon={<Wifi className="h-3 w-3" />} label="Read" onClick={() => onCommand('lf read')} disabled={!commandsEnabled} />
              <MiniButton icon={<Eye className="h-3 w-3" />} label="Sniff" onClick={() => onCommand('lf sniff')} disabled={!commandsEnabled} />
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
            <CompactGroup title={LF_CARD_TYPES.find(c => c.value === selectedLFCardType)?.label || 'Operations'}>
              {LF_CARD_OPERATIONS[selectedLFCardType]?.map((op) => (
                <MiniButton
                  key={op.label}
                  icon={getIcon(op.icon)}
                  label={op.label}
                  onClick={() => onCommand(op.command)}
                  disabled={!commandsEnabled}
                  variant={op.variant || 'outline'}
                />
              ))}
            </CompactGroup>
          </div>
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-start gap-2">
            <RibbonGroup title="Capture">
              <RibbonButton
                icon={<Search />}
                label="Samples"
                onClick={() => onCommand('data samples -n 40000')}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Download />}
                label="Save"
                onClick={() => onCommand('data save -f trace.bin')}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Upload />}
                label="Load"
                onClick={() => onCommand('data load -f trace.bin')}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Square />}
                label="Clear"
                onClick={() => onCommand('data clear')}
                disabled={!commandsEnabled}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="Analysis">
              <RibbonButton
                icon={<Search />}
                label="Autocorr"
                onClick={() => onCommand('data autocorr')}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Zap />}
                label="Detect Clk"
                onClick={() => onCommand('data detectclock')}
                disabled={!commandsEnabled}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="Convert">
              <RibbonButton
                icon={<Download />}
                label="bin→eml"
                onClick={() => onCommand('script run data_mf_bin2eml -h')}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Upload />}
                label="eml→bin"
                onClick={() => onCommand('script run data_mf_eml2bin -h')}
                disabled={!commandsEnabled}
              />
            </RibbonGroup>
          </div>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-start gap-2">
            <RibbonGroup title="Scripts">
              <RibbonButton
                icon={<Play />}
                label="List Scripts"
                onClick={() => onCommand('script list')}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Play />}
                label="UID Bruteforce"
                onClick={() => onCommand('script run hf_mf_uidbruteforce -h')}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Play />}
                label="Format Card"
                onClick={() => onCommand('script run hf_mf_format -h')}
                disabled={!commandsEnabled}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="Key Memory">
              <RibbonButton
                icon={<Key />}
                label="Load MFC"
                onClick={() => onCommand('mem load -f mfc_default_keys --mfc')}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Key />}
                label="Load iClass"
                onClick={() => onCommand('mem load -f iclass_default_keys --iclass')}
                disabled={!commandsEnabled}
              />
              <RibbonButton
                icon={<Key />}
                label="Load T55xx"
                onClick={() => onCommand('mem load -f t55xx_default_pwds --t55xx')}
                disabled={!commandsEnabled}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="Help">
              <RibbonButton
                icon={<HelpCircle />}
                label="Help"
                onClick={() => onCommand('help')}
                disabled={false}
              />
              <RibbonButton
                icon={<Settings />}
                label="Prefs"
                onClick={() => onCommand('prefs show')}
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
              onUse={onCacheUse}
              onDelete={onCacheDelete}
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
                    e.target.value = '';
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
                    e.target.value = '';
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
                    e.target.value = '';
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
                onClick={() => onCommand('hf mf autopwn --1k')}
                disabled={!commandsEnabled}
                variant="default"
              />
              <MiniButton
                icon={<Download className="h-3 w-3" />}
                label="Dump"
                onClick={() => onCommand('hf mf dump')}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Upload className="h-3 w-3" />}
                label="Restore"
                onClick={() => onCommand('hf mf restore')}
                disabled={!commandsEnabled}
              />
            </CompactGroup>

            <Separator orientation="vertical" className="h-14 shrink-0" />

            <CompactGroup title="Emulator">
              <MiniButton
                icon={<Download className="h-3 w-3" />}
                label="Load"
                onClick={() => onCommand('hf mf eload')}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Upload className="h-3 w-3" />}
                label="Save"
                onClick={() => onCommand('hf mf esave')}
                disabled={!commandsEnabled}
              />
              <MiniButton
                icon={<Play className="h-3 w-3" />}
                label="Simulate"
                onClick={() => onCommand('hf mf sim --1k')}
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
                    e.target.value = '';
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
      </Tabs>
    </div>
  );
}

export default RibbonToolbar;
