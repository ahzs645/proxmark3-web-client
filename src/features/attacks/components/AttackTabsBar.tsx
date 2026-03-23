import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ATTACK_ENTRIES } from "../config";
import type { AttackType } from "../types";

interface AttackTabsBarProps {
  activeAttack: AttackType;
  onActiveAttackChange: (attack: AttackType) => void;
}

export function AttackTabsBar({ activeAttack, onActiveAttackChange }: AttackTabsBarProps) {
  return (
    <Tabs
      value={activeAttack}
      onValueChange={(value) => onActiveAttackChange(value as AttackType)}
      className="flex-1"
    >
      <div className="px-3 pt-3">
        <TabsList className="grid h-auto grid-cols-3 gap-1 lg:grid-cols-6">
          {ATTACK_ENTRIES.map(([key, cfg]) => (
            <TabsTrigger
              key={key}
              value={key}
              className="px-2 py-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <span className="flex items-center gap-1">
                <cfg.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{cfg.label}</span>
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}
