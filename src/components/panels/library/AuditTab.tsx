import { Download, FileText, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { exportOperationReport, base64ToBytes } from "@/features/operations/report";
import { useVaultBackups, useVaultOperations } from "@/features/vault/hooks";
import { deleteBackup, deleteOperation } from "@/features/vault/operations";

function downloadBackup(name: string, base64: string, mimeType: string): void {
  const bytes = base64ToBytes(base64);
  const blob = new Blob([Uint8Array.from(bytes).buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AuditTab() {
  const operations = useVaultOperations();
  const backups = useVaultBackups();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" />
            Operation reports
          </h3>
          <Badge variant="secondary">{operations.length}</Badge>
        </div>
        {operations.length ? (
          operations.map((operation) => (
            <div key={operation.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">
                    {operation.workflow ?? operation.command}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {operation.summary ?? operation.status}
                  </div>
                </div>
                <Badge
                  variant={
                    operation.status === "succeeded"
                      ? "success"
                      : operation.status === "failed"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {operation.status}
                </Badge>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{operation.targetUid || "No UID"}</span>
                <span>
                  {operation.durationMs == null
                    ? ""
                    : `${(operation.durationMs / 1000).toFixed(1)}s`}
                </span>
                <span>{operation.checks?.length ?? 0} checks</span>
              </div>
              <div className="mt-2 flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportOperationReport(operation)}
                >
                  <Download className="mr-1 h-3 w-3" />
                  Report
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void deleteOperation(operation.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            No completed operations yet.
          </div>
        )}
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4" />
            Before-image backups
          </h3>
          <Badge variant="secondary">{backups.length}</Badge>
        </div>
        {backups.length ? (
          backups.map((backup) => (
            <div key={backup.id} className="rounded-md border p-3">
              <div className="text-sm font-medium">{backup.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {backup.kind} · {backup.uid || "No UID"} · {backup.size} bytes
              </div>
              <div className="mt-2 flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadBackup(backup.name, backup.base64, backup.mimeType)}
                >
                  <Download className="mr-1 h-3 w-3" />
                  Download
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void deleteBackup(backup.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Backups created by safe write workflows appear here.
          </div>
        )}
      </section>
    </div>
  );
}
