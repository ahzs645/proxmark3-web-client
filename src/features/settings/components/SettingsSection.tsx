import type { ReactNode } from "react";
import { PanelSection } from "@/components/panels/shared/PanelSection";

interface SettingsSectionProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}

/** One boxed block of the Settings page; the page's section nav jumps between these. */
export function SettingsSection({ icon, title, children }: SettingsSectionProps) {
  return (
    <PanelSection icon={icon} title={title} className="space-y-3">
      {children}
    </PanelSection>
  );
}
