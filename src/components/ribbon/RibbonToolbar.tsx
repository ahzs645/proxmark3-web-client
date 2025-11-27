import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import type { ConnectionStatus } from '@/hooks/useWebSerial';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import type { Theme } from '@/hooks/useTheme';
import { CommandDeck } from '@/components/panels/CommandDeck';
import { CheatSheetPanel } from '@/components/panels/CheatSheetPanel';
import { KeyCachePanel, type CachedAsset } from '@/components/panels/KeyCachePanel';

interface RibbonToolbarProps {
  connectionStatus: ConnectionStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  onCommand: (cmd: string) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  canRunCommands?: boolean;
  cacheItems: CachedAsset[];
  cacheSyncing?: boolean;
  onCacheUpload: (files: FileList | null) => void;
  onCacheUse: (item: CachedAsset, template: string) => void;
  onCacheDelete: (id: string) => void;
  onCacheSync: () => void;
  cachePathPrefix?: string;
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

export function RibbonToolbar({
  connectionStatus,
  onConnect,
  onDisconnect,
  onCommand,
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
}: RibbonToolbarProps) {
  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';

  return (
    <div className="border-b border-border bg-card">
      <Tabs defaultValue="connect" className="w-full">
        <div className="flex items-center px-2 border-b border-border">
          <TabsList className="h-9 bg-transparent">
            <TabsTrigger value="connect" className="text-xs">Connect</TabsTrigger>
            <TabsTrigger value="hf" className="text-xs">HF</TabsTrigger>
            <TabsTrigger value="lf" className="text-xs">LF</TabsTrigger>
            <TabsTrigger value="data" className="text-xs">Data</TabsTrigger>
            <TabsTrigger value="tools" className="text-xs">Tools</TabsTrigger>
            <TabsTrigger value="actions" className="text-xs">Shortcuts</TabsTrigger>
          </TabsList>

          <div className="ml-auto flex items-center gap-2 pr-2">
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
                disabled={!isConnected}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="Device">
              <RibbonButton
                icon={<HelpCircle />}
                label="Info"
                onClick={() => onCommand('hw version')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Zap />}
                label="Tune"
                onClick={() => onCommand('hw tune')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Settings />}
                label="Status"
                onClick={() => onCommand('hw status')}
                disabled={!isConnected}
              />
            </RibbonGroup>
          </div>
        </TabsContent>

        {/* HF Tab */}
        <TabsContent value="hf" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-start gap-2">
            <RibbonGroup title="Search">
              <RibbonButton
                icon={<Search />}
                label="Search"
                onClick={() => onCommand('hf search')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Radio />}
                label="14A Info"
                onClick={() => onCommand('hf 14a info')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Eye />}
                label="Sniff"
                onClick={() => onCommand('hf sniff')}
                disabled={!isConnected}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="MIFARE Classic">
              <RibbonButton
                icon={<CreditCard />}
                label="Info"
                onClick={() => onCommand('hf mf info')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Key />}
                label="Autopwn 1K"
                onClick={() => onCommand('hf mf autopwn --1k')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Key />}
                label="Autopwn 4K"
                onClick={() => onCommand('hf mf autopwn --4k')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Download />}
                label="Dump"
                onClick={() => onCommand('hf mf dump')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Upload />}
                label="Restore"
                onClick={() => onCommand('hf mf restore')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Play />}
                label="Sim"
                onClick={() => onCommand('hf mf sim')}
                disabled={!isConnected}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="Classic Attacks">
              <RibbonButton
                icon={<Zap />}
                label="Hardnested"
                onClick={() => onCommand('hf mf hardnested --blk 0 -a -k FFFFFFFFFFFF --tblk 4 --ta -w')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Key />}
                label="Nested"
                onClick={() => onCommand('hf mf nested 1 0 a FFFFFFFFFFFF')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Shield />}
                label="Darkside"
                onClick={() => onCommand('hf mf darkside')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<ListChecks />}
                label="Chk Defaults"
                onClick={() => onCommand('hf mf chk --1k -f mfc_default_keys')}
                disabled={!isConnected}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="MIFARE Ultralight">
              <RibbonButton
                icon={<CreditCard />}
                label="Info"
                onClick={() => onCommand('hf mfu info')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Download />}
                label="Dump"
                onClick={() => onCommand('hf mfu dump')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Play />}
                label="Sim"
                onClick={() => onCommand('hf mfu sim -t 7')}
                disabled={!isConnected}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="iClass">
              <RibbonButton
                icon={<Shield />}
                label="Info"
                onClick={() => onCommand('hf iclass info')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Download />}
                label="Dump"
                onClick={() => onCommand('hf iclass dump')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Key />}
                label="Keys"
                onClick={() => onCommand('hf iclass managekeys -p')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Play />}
                label="Sim"
                onClick={() => onCommand('hf iclass sim -t 3')}
                disabled={!isConnected}
              />
            </RibbonGroup>
          </div>
        </TabsContent>

        {/* LF Tab */}
        <TabsContent value="lf" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-start gap-2">
            <RibbonGroup title="Search">
              <RibbonButton
                icon={<Search />}
                label="Search"
                onClick={() => onCommand('lf search')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Wifi />}
                label="Read"
                onClick={() => onCommand('lf read')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Eye />}
                label="Sniff"
                onClick={() => onCommand('lf sniff')}
                disabled={!isConnected}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="EM4x">
              <RibbonButton
                icon={<Radio />}
                label="Read"
                onClick={() => onCommand('lf em 410x reader')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Copy />}
                label="Clone"
                onClick={() => onCommand('lf em 410x clone')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Play />}
                label="Sim"
                onClick={() => onCommand('lf em 410x sim')}
                disabled={!isConnected}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="HID">
              <RibbonButton
                icon={<CreditCard />}
                label="Read"
                onClick={() => onCommand('lf hid read')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Copy />}
                label="Clone"
                onClick={() => onCommand('lf hid clone')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Play />}
                label="Sim"
                onClick={() => onCommand('lf hid sim')}
                disabled={!isConnected}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="HID Attack">
              <RibbonButton
                icon={<Zap />}
                label="Brute"
                onClick={() => onCommand('lf hid brute -w H10301 -f 101')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Eye />}
                label="Demod"
                onClick={() => onCommand('lf hid demod')}
                disabled={!isConnected}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="T55xx">
              <RibbonButton
                icon={<Search />}
                label="Detect"
                onClick={() => onCommand('lf t55xx detect')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Download />}
                label="Dump"
                onClick={() => onCommand('lf t55xx dump')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Edit3 />}
                label="Write"
                onClick={() => onCommand('lf t55xx write')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Square />}
                label="Wipe"
                onClick={() => onCommand('lf t55xx wipe')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Radio />}
                label="Config FSK"
                onClick={() => onCommand('lf t55xx config --FSK')}
                disabled={!isConnected}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="Indala">
              <RibbonButton
                icon={<Radio />}
                label="Read"
                onClick={() => onCommand('lf indala read')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Copy />}
                label="Clone"
                onClick={() => onCommand('lf indala clone')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Play />}
                label="Sim"
                onClick={() => onCommand('lf indala sim')}
                disabled={!isConnected}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="Wiegand">
              <RibbonButton
                icon={<Book />}
                label="List"
                onClick={() => onCommand('wiegand list')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Download />}
                label="Encode"
                onClick={() => onCommand('wiegand encode --fc 101 --cn 1337')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Upload />}
                label="Decode"
                onClick={() => onCommand('wiegand decode --raw 2006f623ae')}
                disabled={!isConnected}
              />
            </RibbonGroup>
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
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Download />}
                label="Save"
                onClick={() => onCommand('data save -f trace.bin')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Upload />}
                label="Load"
                onClick={() => onCommand('data load -f trace.bin')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Square />}
                label="Clear"
                onClick={() => onCommand('data clear')}
                disabled={!isConnected}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="Analysis">
              <RibbonButton
                icon={<Search />}
                label="Autocorr"
                onClick={() => onCommand('data autocorr')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Zap />}
                label="Detect Clk"
                onClick={() => onCommand('data detectclock')}
                disabled={!isConnected}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="Convert">
              <RibbonButton
                icon={<Download />}
                label="bin→eml"
                onClick={() => onCommand('script run data_mf_bin2eml -h')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Upload />}
                label="eml→bin"
                onClick={() => onCommand('script run data_mf_eml2bin -h')}
                disabled={!isConnected}
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
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Play />}
                label="UID Bruteforce"
                onClick={() => onCommand('script run hf_mf_uidbruteforce -h')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Play />}
                label="Format Card"
                onClick={() => onCommand('script run hf_mf_format -h')}
                disabled={!isConnected}
              />
            </RibbonGroup>

            <Separator orientation="vertical" className="h-16" />

            <RibbonGroup title="Key Memory">
              <RibbonButton
                icon={<Key />}
                label="Load MFC"
                onClick={() => onCommand('mem load -f mfc_default_keys --mfc')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Key />}
                label="Load iClass"
                onClick={() => onCommand('mem load -f iclass_default_keys --iclass')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Key />}
                label="Load T55xx"
                onClick={() => onCommand('mem load -f t55xx_default_pwds --t55xx')}
                disabled={!isConnected}
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
                disabled={!isConnected}
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
      </Tabs>
    </div>
  );
}

export default RibbonToolbar;
