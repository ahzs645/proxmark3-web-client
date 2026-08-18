import type { ReactNode } from "react";
import { PanelSection } from "@/components/panels/shared/PanelSection";

/**
 * The Utilities panel's boxed section. Now a thin wrapper over the shared
 * {@link PanelSection} so it matches every other panel's grouped blocks.
 */
export function UtilitySection({ title, children }: { title: string; children: ReactNode }) {
  return <PanelSection title={title}>{children}</PanelSection>;
}
