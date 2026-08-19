import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VirtualCardMemberKind } from "@/features/vault/db";
import { colorDotClass } from "@/features/vault/virtualCards";
import { useMemberOf } from "./membership";

interface MemberOfBadgesProps {
  kind: VirtualCardMemberKind;
  refId: string;
  className?: string;
}

/** "Part of <virtual card>" chips, shown on the rows a virtual card claims. */
export function MemberOfBadges({ kind, refId, className }: MemberOfBadgesProps) {
  const owners = useMemberOf(kind, refId);
  if (!owners.length) return null;

  return (
    <>
      {owners.map((owner) => (
        <Badge key={owner.id} variant="outline" className={cn("gap-1.5", className)}>
          <span className={cn("h-2 w-2 rounded-full", colorDotClass(owner.color))} />
          {owner.name}
        </Badge>
      ))}
    </>
  );
}
