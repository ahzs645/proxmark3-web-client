import { Settings } from "lucide-react";
import { SettingsSection } from "./SettingsSection";

interface BehaviorSectionProps {
  confirmDestructiveOps: boolean;
  showAdvancedOptions: boolean;
  onConfirmDestructiveOpsChange: (value: boolean) => void;
  onShowAdvancedOptionsChange: (value: boolean) => void;
}

export function BehaviorSection({
  confirmDestructiveOps,
  showAdvancedOptions,
  onConfirmDestructiveOpsChange,
  onShowAdvancedOptionsChange,
}: BehaviorSectionProps) {
  return (
    <SettingsSection icon={<Settings className="h-3 w-3" />} title="Behavior">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmDestructiveOps}
          onChange={(e) => onConfirmDestructiveOpsChange(e.target.checked)}
          className="rounded border-gray-300"
        />
        <span>Confirm destructive operations (wipe, format)</span>
      </label>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showAdvancedOptions}
          onChange={(e) => onShowAdvancedOptionsChange(e.target.checked)}
          className="rounded border-gray-300"
        />
        <span>Show advanced options by default</span>
      </label>
    </SettingsSection>
  );
}
