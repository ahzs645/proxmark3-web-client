import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface RibbonButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "secondary" | "ghost";
}

export function RibbonButton({
  icon,
  label,
  onClick,
  disabled,
  variant = "ghost",
}: RibbonButtonProps) {
  return (
    <Button
      variant={variant}
      size="ribbon"
      onClick={onClick}
      disabled={disabled}
      className="h-16 w-16 flex-col gap-1 text-xs"
    >
      {icon}
      <span className="text-[10px] leading-tight">{label}</span>
    </Button>
  );
}

interface MiniButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "secondary" | "outline" | "ghost";
}

export function MiniButton({
  icon,
  label,
  onClick,
  disabled,
  variant = "outline",
}: MiniButtonProps) {
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="h-7 gap-1 px-2 text-xs"
    >
      {icon}
      {label}
    </Button>
  );
}

export function RibbonGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col">
      <div className="flex items-end gap-1 px-2 pb-1">{children}</div>
      <div className="border-border border-t px-2 pt-1 text-center text-[9px] text-muted-foreground">
        {title}
      </div>
    </div>
  );
}

export function CompactGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-1">
      <div className="px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}
