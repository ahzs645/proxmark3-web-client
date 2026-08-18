import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PanelHeaderProps {
  /** Leading icon, shown in a tinted chip. */
  icon: LucideIcon;
  title: string;
  /** Short qualifier rendered as an outline badge next to the title. */
  tag?: ReactNode;
  /** Right-aligned controls (detect buttons, status badges, selects…). */
  actions?: ReactNode;
  className?: string;
}

/**
 * The shared chrome for every operation panel. Consolidates the near-identical
 * `CardHeader` each panel hand-rolled into one header: a tinted icon chip, the
 * uppercase panel title, an optional qualifier badge, and a right-side action
 * slot. Using it everywhere is what makes the panels read as one toolset.
 */
export function PanelHeader({ icon: Icon, title, tag, actions, className }: PanelHeaderProps) {
  return (
    <CardHeader className={cn("shrink-0 space-y-0 border-b p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <CardTitle className="truncate text-sm">{title}</CardTitle>
          {tag ? (
            <Badge variant="outline" className="shrink-0 font-normal">
              {tag}
            </Badge>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </CardHeader>
  );
}

export default PanelHeader;
