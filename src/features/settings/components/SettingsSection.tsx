import { Separator } from "@/components/ui/separator";
import type { ReactNode } from "react";

interface SettingsSectionProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}

export function SettingsSection({ icon, title, children }: SettingsSectionProps) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </label>
      {children}
      <Separator />
    </div>
  );
}
