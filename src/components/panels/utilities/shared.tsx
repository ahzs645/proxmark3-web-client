import type { ReactNode } from "react";

export function UtilitySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4 rounded-xl border bg-card/40 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}
