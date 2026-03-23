import type { ReactNode } from "react";

export function SectionLabel({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
      {icon}
      {children}
    </label>
  );
}
