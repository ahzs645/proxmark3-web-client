import { Button } from "@/components/ui/button";
import { Database } from "lucide-react";
import type { CachedAsset } from "@/components/panels/KeyCachePanel";
import { bytesToHex } from "../utils";

interface HexInputPanelProps {
  dumps: CachedAsset[];
  input: string;
  onInputChange: (value: string) => void;
  onLoadDump: (hexString: string) => void;
}

export function HexInputPanel({ dumps, input, onInputChange, onLoadDump }: HexInputPanelProps) {
  return (
    <div className="space-y-2 border-b p-3">
      <textarea
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder="Paste hex dump here (e.g., 3DD6CCC2E5088400...)&#10;&#10;Or load from a cached dump below"
        className="min-h-[80px] w-full resize-none rounded-md border border-border bg-secondary/30 p-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {dumps.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Database className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Load:</span>
          {dumps.slice(0, 4).map((dump) => (
            <Button
              key={dump.id}
              size="sm"
              variant="ghost"
              onClick={() => {
                if (!dump.base64) return;
                const binary = atob(dump.base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                  bytes[i] = binary.charCodeAt(i);
                }
                onLoadDump(bytesToHex(bytes));
              }}
              className="h-6 text-[10px]"
            >
              {dump.relativePath || dump.name}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
