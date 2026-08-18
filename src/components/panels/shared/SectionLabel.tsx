import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionLabelProps {
  /** Small leading glyph (usually a 3×3 lucide icon). */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * The one inline section label used inside every panel. Replaces the three
 * near-identical labels the panels grew independently (LF/T55xx `SectionLabel`,
 * the Settings label, and the Attacks/Magic `text-[10px]` labels) so a "section
 * heading" looks the same everywhere.
 */
export function SectionLabel({ icon, children, className }: SectionLabelProps) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export default SectionLabel;
