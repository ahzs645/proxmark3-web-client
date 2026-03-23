import { AlertTriangle } from "lucide-react";

export function MagicWarningSection() {
  return (
    <div className="p-3">
      <div className="flex items-start gap-2 rounded bg-amber-500/10 p-2 text-[10px] text-amber-400">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Magic cards are for educational purposes. Cloning access cards without authorization may
          be illegal in your jurisdiction.
        </span>
      </div>
    </div>
  );
}
