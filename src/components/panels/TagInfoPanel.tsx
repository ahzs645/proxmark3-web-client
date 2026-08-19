import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TagInfoBadges } from "@/features/tag-info/TagInfoBadges";
import { TagInfoDetailsGrid } from "@/features/tag-info/TagInfoDetailsGrid";
import { TagInfoEmptyState } from "@/features/tag-info/TagInfoEmptyState";
import { TagInfoHeader } from "@/features/tag-info/TagInfoHeader";
import { TagInfoSuggestedActions } from "@/features/tag-info/TagInfoSuggestedActions";
import { getSuggestedActions } from "@/features/tag-info/helpers";
import type { TagInfoPanelProps } from "@/features/tag-info/types";

export type { TagInfo } from "@/features/tag-info/types";

export function TagInfoPanel({
  tagInfo,
  onRefresh,
  onCopyUid,
  onCommand,
  disabled = false,
  libraryKeyMode = "default",
  matchingKeyCount = 0,
  libraryKeyCount = 0,
  onLibraryKeyModeChange,
}: TagInfoPanelProps) {
  const suggestedActions = useMemo(() => getSuggestedActions(tagInfo), [tagInfo]);

  if (!tagInfo) {
    return <TagInfoEmptyState onCommand={onCommand} disabled={disabled} />;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <TagInfoHeader onRefresh={onRefresh} />
      </CardHeader>
      <CardContent className="space-y-3">
        <TagInfoBadges tagInfo={tagInfo} />
        <TagInfoDetailsGrid tagInfo={tagInfo} onCopyUid={onCopyUid} />
        <TagInfoSuggestedActions
          suggestedActions={suggestedActions}
          onCommand={onCommand}
          disabled={disabled}
          libraryKeyMode={libraryKeyMode}
          matchingKeyCount={matchingKeyCount}
          libraryKeyCount={libraryKeyCount}
          onLibraryKeyModeChange={onLibraryKeyModeChange}
        />
      </CardContent>
    </Card>
  );
}

export default TagInfoPanel;
