import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Copy, RefreshCw } from 'lucide-react';

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
}

export function TagInfoPanel({ tagInfo, onRefresh, onCopyUid }: TagInfoPanelProps) {
  if (!tagInfo) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Tag Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CreditCard className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm">No tag detected</p>
            <p className="text-xs mt-1">Place a tag on the reader</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Tag Information
          </CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Protocol Badge */}
        <div className="flex items-center gap-2">
          <Badge variant={tagInfo.protocol === 'HF' ? 'default' : 'secondary'}>
            {tagInfo.protocol || 'Unknown'}
          </Badge>
          {tagInfo.subtype && (
            <Badge variant="outline">{tagInfo.subtype}</Badge>
          )}
        </div>

        {/* UID */}
        {tagInfo.uid && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">UID</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-secondary px-2 py-1 rounded text-sm font-mono">
                {tagInfo.uid}
              </code>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopyUid}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        <Separator />

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {tagInfo.type && (
            <div>
              <label className="text-xs text-muted-foreground block">Type</label>
              <span className="font-medium">{tagInfo.type}</span>
            </div>
          )}

          {tagInfo.manufacturer && (
            <div>
              <label className="text-xs text-muted-foreground block">Manufacturer</label>
              <span className="font-medium">{tagInfo.manufacturer}</span>
            </div>
          )}

          {tagInfo.sak && (
            <div>
              <label className="text-xs text-muted-foreground block">SAK</label>
              <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">{tagInfo.sak}</code>
            </div>
          )}

          {tagInfo.atqa && (
            <div>
              <label className="text-xs text-muted-foreground block">ATQA</label>
              <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">{tagInfo.atqa}</code>
            </div>
          )}

          {tagInfo.size && (
            <div>
              <label className="text-xs text-muted-foreground block">Size</label>
              <span className="font-medium">{tagInfo.size}</span>
            </div>
          )}

          {tagInfo.ats && (
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground block">ATS</label>
              <code className="text-xs bg-secondary px-1.5 py-0.5 rounded break-all">
                {tagInfo.ats}
              </code>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default TagInfoPanel;
