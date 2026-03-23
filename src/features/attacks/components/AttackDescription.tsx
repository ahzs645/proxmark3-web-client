import type { AttackConfig } from "../types";

interface AttackDescriptionProps {
  config: AttackConfig;
}

export function AttackDescription({ config }: AttackDescriptionProps) {
  return (
    <div className="flex items-start gap-2 rounded bg-secondary/30 p-2 text-xs">
      <config.icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <span className="font-medium">{config.label}:</span>{" "}
        <span className="text-muted-foreground">{config.description}</span>
      </div>
    </div>
  );
}
