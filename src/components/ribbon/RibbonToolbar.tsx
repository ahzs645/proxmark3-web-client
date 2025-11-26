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
} from 'lucide-react';
import type { ConnectionStatus } from '@/hooks/useWebSerial';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import type { Theme } from '@/hooks/useTheme';

interface RibbonToolbarProps {
  connectionStatus: ConnectionStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  onCommand: (cmd: string) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
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
                label="Autopwn"
                onClick={() => onCommand('hf mf autopwn')}
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
            </RibbonGroup>
          </div>
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-start gap-2">
            <RibbonGroup title="Buffer">
              <RibbonButton
                icon={<Eye />}
                label="Plot"
                onClick={() => onCommand('data plot')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Download />}
                label="Save"
                onClick={() => onCommand('data save')}
                disabled={!isConnected}
              />
              <RibbonButton
                icon={<Upload />}
                label="Load"
                onClick={() => onCommand('data load')}
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
          </div>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="m-0 p-2 ribbon-tab-content">
          <div className="flex items-start gap-2">
            <RibbonGroup title="Scripts">
              <RibbonButton
                icon={<Play />}
                label="Run Script"
                onClick={() => onCommand('script list')}
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
      </Tabs>
    </div>
  );
}

export default RibbonToolbar;
