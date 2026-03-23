import { Badge } from "@/components/ui/badge";
import { Key, Lock, Unlock } from "lucide-react";
import { permissionToString } from "@/lib/accessBits";
import type { Permission, PermissionBadgeVariant } from "../types";

const VARIANTS: Record<Permission, PermissionBadgeVariant> = {
  A: { variant: "default", icon: <Key className="h-2.5 w-2.5" /> },
  B: { variant: "secondary", icon: <Key className="h-2.5 w-2.5" /> },
  "A|B": { variant: "outline", icon: <Unlock className="h-2.5 w-2.5" /> },
  never: { variant: "destructive", icon: <Lock className="h-2.5 w-2.5" /> },
};

export function PermissionBadge({ perm }: { perm: Permission }) {
  const { variant, icon } = VARIANTS[perm];

  return (
    <Badge variant={variant} className="gap-0.5 px-1 py-0 text-[9px]">
      {icon}
      {permissionToString(perm)}
    </Badge>
  );
}
