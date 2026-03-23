import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Filter } from "lucide-react";

interface TrafficFilterBarProps {
  filterDirection: "all" | "reader" | "tag";
  showAnnotations: boolean;
  filteredCount: number;
  onFilterDirectionChange: (direction: "all" | "reader" | "tag") => void;
  onToggleAnnotations: () => void;
}

export function TrafficFilterBar({
  filterDirection,
  showAnnotations,
  filteredCount,
  onFilterDirectionChange,
  onToggleAnnotations,
}: TrafficFilterBarProps) {
  return (
    <div className="flex items-center gap-4 border-b px-3 py-2">
      <div className="flex items-center gap-2">
        <Filter className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Filter:</span>
        <div className="flex overflow-hidden rounded-md border">
          {(["all", "reader", "tag"] as const).map((dir) => (
            <Button
              key={dir}
              size="sm"
              variant={filterDirection === dir ? "default" : "ghost"}
              onClick={() => onFilterDirectionChange(dir)}
              className="h-6 rounded-none px-2 text-[10px]"
            >
              {dir === "all" ? "All" : dir === "reader" ? "Reader" : "Tag"}
            </Button>
          ))}
        </div>
      </div>

      <Separator orientation="vertical" className="h-4" />

      <Button
        size="sm"
        variant="ghost"
        onClick={onToggleAnnotations}
        className="h-6 gap-1 text-[10px]"
      >
        {showAnnotations ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        Annotations
      </Button>

      <div className="ml-auto text-xs text-muted-foreground">{filteredCount} frames</div>
    </div>
  );
}
