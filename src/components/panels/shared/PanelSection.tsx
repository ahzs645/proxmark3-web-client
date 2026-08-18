import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SectionLabel } from "./SectionLabel";

interface PanelSectionProps {
  title: string;
  /** Small leading glyph for the section title. */
  icon?: ReactNode;
  /** Right-aligned controls in the section header. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * A boxed, titled section — the container form of {@link SectionLabel}.
 * Generalizes the old `UtilitySection`/`SettingsSection` cards so every grouped
 * block of controls shares the same border, tint, padding, and title type.
 */
export function PanelSection({ title, icon, actions, className, children }: PanelSectionProps) {
  return (
    <section className={cn("space-y-4 rounded-xl border bg-card/40 p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <SectionLabel icon={icon}>{title}</SectionLabel>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export default PanelSection;
