import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, Download, Radio, Search, Volume2 } from "lucide-react";
import { PanelSection } from "@/components/panels/shared/PanelSection";

interface LFOperationsSectionProps {
  samples: string;
  onSamplesChange: (value: string) => void;
  onSearch: () => void;
  onTune: () => void;
  onRead: () => void;
  onSniff: () => void;
  disabled?: boolean;
}

export function LFOperationsSection({
  samples,
  onSamplesChange,
  onSearch,
  onTune,
  onRead,
  onSniff,
  disabled = false,
}: LFOperationsSectionProps) {
  return (
    <PanelSection title="Operations" icon={<Activity className="h-3 w-3" />}>
      {/* Four across once there is room; two by two on a phone. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button
          size="lg"
          onClick={onSearch}
          disabled={disabled}
          className="flex h-auto flex-col items-center gap-1 py-3"
        >
          <Search className="h-5 w-5" />
          <span className="text-xs font-medium">Search</span>
          <span className="text-[9px] text-primary-foreground/75">Auto-detect tag</span>
        </Button>

        <Button
          size="lg"
          variant="secondary"
          onClick={onRead}
          disabled={disabled}
          className="flex h-auto flex-col items-center gap-1 py-3"
        >
          <Download className="h-5 w-5" />
          <span className="text-xs font-medium">Read</span>
          <span className="text-[9px] text-secondary-foreground/70">Field ON</span>
        </Button>

        <Button
          size="lg"
          variant="outline"
          onClick={onSniff}
          disabled={disabled}
          className="flex h-auto flex-col items-center gap-1 py-3"
        >
          <Radio className="h-5 w-5" />
          <span className="text-xs font-medium">Sniff</span>
          <span className="text-[9px] text-muted-foreground">Field OFF</span>
        </Button>

        <Button
          size="lg"
          variant="outline"
          onClick={onTune}
          disabled={disabled}
          className="flex h-auto flex-col items-center gap-1 py-3"
        >
          <Volume2 className="h-5 w-5" />
          <span className="text-xs font-medium">Tune</span>
          <span className="text-[9px] text-muted-foreground">Antenna check</span>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Samples:</label>
        <Input
          type="number"
          value={samples}
          onChange={(e) => onSamplesChange(e.target.value)}
          className="h-7 w-24 font-mono text-xs"
          min={1000}
          max={100000}
          step={1000}
        />
      </div>
    </PanelSection>
  );
}
