import { Badge } from "@/components/ui/badge";
import type { TagInfo } from "./types";

interface TagInfoBadgesProps {
  tagInfo: TagInfo;
}

export function TagInfoBadges({ tagInfo }: TagInfoBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={tagInfo.protocol === "HF" ? "default" : "secondary"} className="text-[10px]">
        {tagInfo.protocol || "Unknown"}
      </Badge>
      {tagInfo.subtype ? (
        <Badge variant="outline" className="text-[10px]">
          {tagInfo.subtype}
        </Badge>
      ) : null}
    </div>
  );
}
