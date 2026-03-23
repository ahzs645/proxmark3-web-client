import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpDown, Copy, FileCode2, Trash2 } from "lucide-react";
import type { ViewMode } from "../types";

interface HexViewerHeaderProps {
  totalBytes: number;
  viewMode: ViewMode;
  showOffsetDecimal: boolean;
  hasInput: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onToggleOffsetMode: () => void;
  onCopy: () => void;
  onClear: () => void;
}

export function HexViewerHeader({
  totalBytes,
  viewMode,
  showOffsetDecimal,
  hasInput,
  onViewModeChange,
  onToggleOffsetMode,
  onCopy,
  onClear,
}: HexViewerHeaderProps) {
  return (
    <CardHeader className="border-b pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileCode2 className="h-4 w-4 text-primary" />
          Hex/ASCII Viewer
          {totalBytes > 0 ? (
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {totalBytes} bytes
            </Badge>
          ) : null}
        </CardTitle>
        <div className="flex items-center gap-1">
          <div className="mr-2 flex overflow-hidden rounded-md border">
            {(["8", "16", "32"] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={viewMode === mode ? "default" : "ghost"}
                onClick={() => onViewModeChange(mode)}
                className="h-7 w-8 rounded-none p-0 text-[10px]"
                title={`${mode} bytes per row`}
              >
                {mode}
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleOffsetMode}
            className="h-7 w-7 p-0"
            title={showOffsetDecimal ? "Show hex offset" : "Show decimal offset"}
          >
            <ArrowUpDown className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCopy}
            disabled={!hasInput}
            className="h-7 w-7 p-0"
            title="Copy hex"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClear}
            disabled={!hasInput}
            className="h-7 w-7 p-0"
            title="Clear"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </CardHeader>
  );
}
