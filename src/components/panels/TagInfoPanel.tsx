import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard,
  Copy,
  RefreshCw,
  Key,
  Download,
  Play,
  Zap,
  Shield,
  ChevronRight,
} from 'lucide-react';

export interface TagInfo {
  uid?: string;
  type?: string;
  sak?: string;
  atqa?: string;
  ats?: string;
  manufacturer?: string;
  size?: string;
  protocol?: 'HF' | 'LF';
  subtype?: string;
}

interface TagInfoPanelProps {
  tagInfo: TagInfo | null;
  onRefresh?: () => void;
  onCopyUid?: () => void;
  onCommand?: (cmd: string) => void;
  disabled?: boolean;
}

interface SuggestedAction {
  label: string;
  command: string;
  icon: React.ReactNode;
  variant?: 'default' | 'secondary' | 'outline';
  description?: string;
}

function getCardSize(type?: string): '1k' | '4k' | 'mini' | 'unknown' {
  if (!type) return 'unknown';
  const lower = type.toLowerCase();
  if (lower.includes('4k')) return '4k';
  if (lower.includes('1k')) return '1k';
  if (lower.includes('mini')) return 'mini';
  return 'unknown';
}

function getSuggestedActions(tagInfo: TagInfo | null): SuggestedAction[] {
  if (!tagInfo || !tagInfo.type) return [];

  const type = tagInfo.type.toLowerCase();
  const actions: SuggestedAction[] = [];

  // MIFARE Classic
  if (type.includes('mifare classic') || type.includes('mifare 1k') || type.includes('mifare 4k')) {
    const size = getCardSize(tagInfo.type);
    const sizeFlag = size === '4k' ? '--4k' : '--1k';

    actions.push({
      label: 'Autopwn',
      command: `hf mf autopwn ${sizeFlag}`,
      icon: <Key className="h-3.5 w-3.5" />,
      variant: 'default',
      description: `Crack all keys (${size.toUpperCase()})`,
    });

    actions.push({
      label: 'Dump',
      command: 'hf mf dump',
      icon: <Download className="h-3.5 w-3.5" />,
      variant: 'secondary',
      description: 'Save card to file',
    });

    actions.push({
      label: 'Simulate',
      command: 'hf mf sim',
      icon: <Play className="h-3.5 w-3.5" />,
      variant: 'outline',
      description: 'Emulate this card',
    });

    actions.push({
      label: 'Check Keys',
      command: 'hf mf chk --1k',
      icon: <Shield className="h-3.5 w-3.5" />,
      variant: 'outline',
      description: 'Test default keys',
    });
  }

  // MIFARE Ultralight
  if (type.includes('ultralight') || type.includes('ntag')) {
    actions.push({
      label: 'Dump',
      command: 'hf mfu dump',
      icon: <Download className="h-3.5 w-3.5" />,
      variant: 'default',
      description: 'Read all pages',
    });

    actions.push({
      label: 'Info',
      command: 'hf mfu info',
      icon: <CreditCard className="h-3.5 w-3.5" />,
      variant: 'secondary',
      description: 'Detailed info',
    });

    actions.push({
      label: 'Simulate',
      command: 'hf mfu sim -t 7',
      icon: <Play className="h-3.5 w-3.5" />,
      variant: 'outline',
      description: 'Emulate card',
    });
  }

  // iClass
  if (type.includes('iclass') || type.includes('picopass')) {
    actions.push({
      label: 'Dump',
      command: 'hf iclass dump --ki 0',
      icon: <Download className="h-3.5 w-3.5" />,
      variant: 'default',
      description: 'Read with default key',
    });

    actions.push({
      label: 'Info',
      command: 'hf iclass info',
      icon: <CreditCard className="h-3.5 w-3.5" />,
      variant: 'secondary',
      description: 'Card details',
    });
  }

  // DESFire
  if (type.includes('desfire')) {
    actions.push({
      label: 'Info',
      command: 'hf mfdes info',
      icon: <CreditCard className="h-3.5 w-3.5" />,
      variant: 'default',
      description: 'Application info',
    });

    actions.push({
      label: 'List Apps',
      command: 'hf mfdes lsapp',
      icon: <Shield className="h-3.5 w-3.5" />,
      variant: 'secondary',
      description: 'List applications',
    });
  }

  return actions;
}

export function TagInfoPanel({
  tagInfo,
  onRefresh,
  onCopyUid,
  onCommand,
  disabled = false,
}: TagInfoPanelProps) {
  const suggestedActions = useMemo(() => getSuggestedActions(tagInfo), [tagInfo]);

  if (!tagInfo) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Tag Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <CreditCard className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm">No tag detected</p>
            <p className="text-xs mt-1">Run a search command</p>
            {onCommand && (
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="default"
                  className="text-xs"
                  onClick={() => onCommand('hf search')}
                  disabled={disabled}
                >
                  <Zap className="h-3 w-3 mr-1" />
                  HF Search
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => onCommand('lf search')}
                  disabled={disabled}
                >
                  <Zap className="h-3 w-3 mr-1" />
                  LF Search
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Tag Information
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Protocol & Type Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={tagInfo.protocol === 'HF' ? 'default' : 'secondary'} className="text-[10px]">
            {tagInfo.protocol || 'Unknown'}
          </Badge>
          {tagInfo.subtype && (
            <Badge variant="outline" className="text-[10px]">
              {tagInfo.subtype}
            </Badge>
          )}
        </div>

        {/* UID */}
        {tagInfo.uid && (
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">UID</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-secondary px-2 py-1.5 rounded text-sm font-mono font-medium">
                {tagInfo.uid}
              </code>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onCopyUid}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {tagInfo.type && (
            <div className="col-span-2 p-2 bg-secondary/50 rounded">
              <label className="text-[10px] text-muted-foreground block mb-0.5">Type</label>
              <span className="font-medium">{tagInfo.type}</span>
            </div>
          )}

          {tagInfo.sak && (
            <div className="p-2 bg-secondary/30 rounded">
              <label className="text-[10px] text-muted-foreground block mb-0.5">SAK</label>
              <code className="font-mono">{tagInfo.sak}</code>
            </div>
          )}

          {tagInfo.atqa && (
            <div className="p-2 bg-secondary/30 rounded">
              <label className="text-[10px] text-muted-foreground block mb-0.5">ATQA</label>
              <code className="font-mono">{tagInfo.atqa}</code>
            </div>
          )}

          {tagInfo.manufacturer && (
            <div className="col-span-2 p-2 bg-secondary/30 rounded">
              <label className="text-[10px] text-muted-foreground block mb-0.5">Manufacturer</label>
              <span className="font-medium">{tagInfo.manufacturer}</span>
            </div>
          )}

          {tagInfo.ats && (
            <div className="col-span-2 p-2 bg-secondary/30 rounded">
              <label className="text-[10px] text-muted-foreground block mb-0.5">ATS</label>
              <code className="font-mono text-[10px] break-all">{tagInfo.ats}</code>
            </div>
          )}
        </div>

        {/* Suggested Actions */}
        {suggestedActions.length > 0 && onCommand && (
          <>
            <Separator />
            <div className="space-y-2">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Suggested Actions
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {suggestedActions.slice(0, 4).map((action, idx) => (
                  <Button
                    key={idx}
                    size="sm"
                    variant={action.variant || 'outline'}
                    className="h-auto py-2 px-2 flex flex-col items-start gap-0.5 text-left"
                    onClick={() => onCommand(action.command)}
                    disabled={disabled}
                  >
                    <span className="flex items-center gap-1 text-xs font-medium">
                      {action.icon}
                      {action.label}
                    </span>
                    {action.description && (
                      <span className="text-[9px] text-muted-foreground font-normal">
                        {action.description}
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default TagInfoPanel;
