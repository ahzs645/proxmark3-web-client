interface HexStatsBarProps {
  totalBytes: number;
  rowCount: number;
}

export function HexStatsBar({ totalBytes, rowCount }: HexStatsBarProps) {
  if (totalBytes <= 0) return null;

  return (
    <div className="flex items-center gap-4 border-t bg-secondary/30 px-3 py-2 text-[10px] text-muted-foreground">
      <span>
        <span className="font-medium text-foreground">{totalBytes}</span> bytes
      </span>
      <span>
        <span className="font-medium text-foreground">{rowCount}</span> rows
      </span>
      <div className="ml-auto flex items-center gap-2">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Printable
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          0xFF
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
          0x00
        </span>
      </div>
    </div>
  );
}
