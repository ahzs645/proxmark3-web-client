import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download, Trash2, Upload } from "lucide-react";
import { SettingsSection } from "./SettingsSection";
import type { ChangeEvent } from "react";

interface DataManagementSectionProps {
  cacheCount: number;
  onExportSettings: () => void;
  onImportSettings: (event: ChangeEvent<HTMLInputElement>) => void;
  onResetSettings: () => void;
  onClearCache?: () => void;
}

export function DataManagementSection({
  cacheCount,
  onExportSettings,
  onImportSettings,
  onResetSettings,
  onClearCache,
}: DataManagementSectionProps) {
  const handleClearCache = useCallback(() => {
    if (confirm(`Clear all ${cacheCount} cached files?`)) {
      onClearCache?.();
    }
  }, [cacheCount, onClearCache]);

  return (
    <>
      <SettingsSection icon={<Trash2 className="h-3 w-3" />} title="Data Management">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onExportSettings} className="gap-1">
            <Download className="h-3 w-3" />
            Export Settings
          </Button>
          <Button size="sm" variant="outline" className="relative overflow-hidden gap-1">
            <Upload className="h-3 w-3" />
            Import Settings
            <input
              type="file"
              accept=".json"
              onChange={onImportSettings}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onResetSettings} className="gap-1">
            Reset to Defaults
          </Button>
        </div>

        {onClearCache ? (
          <div className="pt-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleClearCache}
              disabled={cacheCount === 0}
              className="gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Clear Cache ({cacheCount} files)
            </Button>
          </div>
        ) : null}
      </SettingsSection>

      <div className="space-y-1 rounded bg-secondary/30 p-3 text-xs text-muted-foreground">
        <p>
          <strong>Storage:</strong> Settings are saved in browser localStorage
        </p>
        <p>
          <strong>Note:</strong> Some settings may require a page refresh to take effect
        </p>
      </div>

      <div className="flex items-start gap-2 rounded bg-amber-500/10 p-2 text-[10px] text-amber-400">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Clearing the cache will remove all uploaded key files and dumps from browser storage. Make
          sure to backup important files first.
        </span>
      </div>
    </>
  );
}
