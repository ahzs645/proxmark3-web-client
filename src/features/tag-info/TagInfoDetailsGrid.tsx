import { Button } from "@/components/ui/button";
import type { TagInfo } from "./types";
import { Copy } from "lucide-react";

interface TagInfoDetailsGridProps {
  tagInfo: TagInfo;
  onCopyUid?: () => void;
}

function DetailCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string | undefined;
  className?: string;
}) {
  if (!value) return null;

  return (
    <div className={className}>
      <label className="mb-0.5 block text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function TagInfoDetailsGrid({ tagInfo, onCopyUid }: TagInfoDetailsGridProps) {
  return (
    <>
      {tagInfo.uid ? (
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">UID</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-secondary px-2 py-1.5 font-mono text-sm font-medium">
              {tagInfo.uid}
            </code>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onCopyUid}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <DetailCard
          label="Type"
          value={tagInfo.type}
          className="col-span-2 rounded bg-secondary/50 p-2"
        />
        <DetailCard label="SAK" value={tagInfo.sak} className="rounded bg-secondary/30 p-2" />
        <DetailCard label="ATQA" value={tagInfo.atqa} className="rounded bg-secondary/30 p-2" />
        <DetailCard
          label="Manufacturer"
          value={tagInfo.manufacturer}
          className="col-span-2 rounded bg-secondary/30 p-2"
        />
        <DetailCard
          label="ATS"
          value={tagInfo.ats}
          className="col-span-2 rounded bg-secondary/30 p-2"
        />
      </div>
    </>
  );
}
