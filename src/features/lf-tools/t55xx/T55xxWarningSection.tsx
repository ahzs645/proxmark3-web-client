import { AlertTriangle } from "lucide-react";

export function T55xxWarningSection() {
  return (
    <div className="p-3">
      <div className="flex items-start gap-2 rounded bg-amber-500/10 p-2 text-[10px] text-amber-400">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Writing incorrect Block 0 configuration can make the card unusable. Always dump the card
          first and save a backup.
        </span>
      </div>
    </div>
  );
}
