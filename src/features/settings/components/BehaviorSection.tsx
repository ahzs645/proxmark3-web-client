import { Settings } from "lucide-react";
import { SettingsSection } from "./SettingsSection";

interface BehaviorSectionProps {
  confirmDestructiveOps: boolean;
  showAdvancedOptions: boolean;
  onConfirmDestructiveOpsChange: (value: boolean) => void;
  onShowAdvancedOptionsChange: (value: boolean) => void;
  operationProfile: "fast" | "recommended" | "thorough";
  onOperationProfileChange: (value: "fast" | "recommended" | "thorough") => void;
}

export function BehaviorSection({
  confirmDestructiveOps,
  showAdvancedOptions,
  onConfirmDestructiveOpsChange,
  onShowAdvancedOptionsChange,
  operationProfile,
  onOperationProfileChange,
}: BehaviorSectionProps) {
  return (
    <SettingsSection icon={<Settings className="h-3 w-3" />} title="Behavior">
      <label className="grid gap-1 text-sm">
        <span>Destructive workflow profile</span>
        <select
          value={operationProfile}
          onChange={(event) =>
            onOperationProfileChange(event.target.value as "fast" | "recommended" | "thorough")
          }
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="fast">Fast — required safety checks only</option>
          <option value="recommended">Recommended — backup and final verification</option>
          <option value="thorough">Thorough — two-phase and pre-commit verification</option>
        </select>
      </label>
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
