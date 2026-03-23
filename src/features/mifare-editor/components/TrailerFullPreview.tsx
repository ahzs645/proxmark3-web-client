import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

interface TrailerFullPreviewProps {
  trailer: string;
  onCopy: (text: string) => void;
}

export function TrailerFullPreview({ trailer, onCopy }: TrailerFullPreviewProps) {
  return (
    <div className="space-y-2 rounded bg-secondary/30 p-3">
      <label className="text-xs text-muted-foreground">Full Trailer (32 hex chars)</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 break-all rounded border bg-background p-2 font-mono text-sm">
          <span className="text-blue-400">{trailer.slice(0, 12)}</span>
          <span className="text-amber-400">{trailer.slice(12, 18)}</span>
          <span className="text-gray-400">{trailer.slice(18, 20)}</span>
          <span className="text-green-400">{trailer.slice(20, 32)}</span>
        </code>
        <Button size="icon" variant="ghost" onClick={() => onCopy(trailer)}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex gap-4 text-[10px] text-muted-foreground">
        <span>
          <span className="text-blue-400">Key A</span>
        </span>
        <span>
          <span className="text-amber-400">Access</span>
        </span>
        <span>
          <span className="text-gray-400">GPB</span>
        </span>
        <span>
          <span className="text-green-400">Key B</span>
        </span>
      </div>
    </div>
  );
}
