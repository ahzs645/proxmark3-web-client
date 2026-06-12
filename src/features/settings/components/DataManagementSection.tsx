import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AlertTriangle, Download, Trash2, Upload } from "lucide-react";
import { SettingsSection } from "./SettingsSection";
import type { ChangeEvent } from "react";

interface DataManagementSectionProps {
  cacheCount: number;
  importError?: string | null;
  onClearImportError?: () => void;
  onExportSettings: () => void;
  onImportSettings: (event: ChangeEvent<HTMLInputElement>) => void;
  onResetSettings: () => void;
  onClearCache?: () => void;
}

export function DataManagementSection({
  cacheCount,
  importError = null,
  onClearImportError,
  onExportSettings,
  onImportSettings,
  onResetSettings,
  onClearCache,
}: DataManagementSectionProps) {
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

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
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmResetOpen(true)}
            className="gap-1"
          >
            Reset to Defaults
          </Button>
        </div>

        {onClearCache ? (
          <div className="pt-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmClearOpen(true)}
              disabled={cacheCount === 0}
              className="gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Clear Cache ({cacheCount} files)
            </Button>
          </div>
        ) : null}
      </SettingsSection>

      <ConfirmDialog
        open={confirmResetOpen}
        title="Reset settings?"
        description="All preferences will return to their default values. Cached files and library entries are not affected."
        confirmLabel="Reset to Defaults"
        onConfirm={onResetSettings}
        onClose={() => setConfirmResetOpen(false)}
      />
      <ConfirmDialog
        open={confirmClearOpen}
        title={`Clear ${cacheCount} cached file${cacheCount === 1 ? "" : "s"}?`}
        description="All uploaded key files and dumps will be removed from browser storage. Export anything you want to keep first."
        confirmLabel="Clear Cache"
        destructive
        onConfirm={onClearCache}
        onClose={() => setConfirmClearOpen(false)}
      />
      <ConfirmDialog
        open={Boolean(importError)}
        title="Import failed"
        description={importError ?? undefined}
        confirmLabel="OK"
        cancelLabel={null}
        onClose={() => onClearImportError?.()}
      />

      <div className="space-y-1 rounded bg-secondary/30 p-3 text-xs text-muted-foreground">
        <p>
          <strong>Storage:</strong> Settings are saved in browser localStorage
        </p>
        <p>
          <strong>Note:</strong> Some settings may require a page refresh to take effect
        </p>
      </div>

      <div className="flex items-start gap-2 rounded bg-amber-500/10 p-2 text-[10px] text-amber-600 dark:text-amber-400">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Clearing the cache will remove all uploaded key files and dumps from browser storage. Make
          sure to backup important files first.
        </span>
      </div>
    </>
  );
}
