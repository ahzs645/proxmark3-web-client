import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { SectionLabel } from "@/components/panels/shared/SectionLabel";

interface SettingsSectionProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}

export function SettingsSection({ icon, title, children }: SettingsSectionProps) {
  return (
    <div className="space-y-3">
      <SectionLabel icon={icon}>{title}</SectionLabel>
      {children}
      <Separator />
    </div>
  );
}
