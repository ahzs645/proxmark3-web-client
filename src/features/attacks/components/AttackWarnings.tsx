import { AlertTriangle, Shield } from "lucide-react";
import type { AttackType } from "../types";

interface AttackWarningsProps {
  activeAttack: AttackType;
}

export function AttackWarnings({ activeAttack }: AttackWarningsProps) {
  return (
    <>
      {activeAttack === "darkside" ? (
        <div className="flex items-start gap-2 rounded bg-amber-500/10 p-2 text-[10px] text-amber-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Darkside attack can take 5-30 minutes. Ensure stable connection and do not move the card
            during the attack.
          </span>
        </div>
      ) : null}

      {activeAttack === "hardnested" ? (
        <div className="flex items-start gap-2 rounded bg-blue-500/10 p-2 text-[10px] text-blue-400">
          <Shield className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Hardnested works on cards with hardened PRNG. It requires one known key and recovers one
            target key per run.
          </span>
        </div>
      ) : null}
    </>
  );
}
