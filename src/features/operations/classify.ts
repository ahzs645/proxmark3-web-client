import type { CommandJob } from "@/features/commands/types";
import type { OperationKind, OperationRecord, OperationStatus } from "@/features/vault/db";

export function classifyOperation(command: string): OperationKind {
  const normalized = command.trim().toLowerCase();
  if (/\b(?:autopwn|hardnested|staticnested|nested|darkside|chk|fchk)\b/.test(normalized)) {
    return "attack";
  }
  if (/\b(?:clone|restore|cload|gload|write|setuid|setblk|wrbl)\b/.test(normalized)) {
    return "write";
  }
  if (/\b(?:wipe|erase|format)\b/.test(normalized)) return "erase";
  if (/\b(?:dump|read|reader|search|info|detect|view)\b/.test(normalized)) return "read";
  if (/^hw\s+(?:version|status|ping)/.test(normalized)) return "device";
  return "command";
}

export function operationStatus(job: CommandJob): OperationStatus {
  if (job.status === "stopped") return "cancelled";
  if (job.resultKind === "failure") return "failed";
  if (job.resultKind === "warning") return "warning";
  if (job.status === "done") return "succeeded";
  return "running";
}

interface OperationContext {
  targetUid?: string;
  targetType?: string;
  transport?: string;
}

export function operationFromJob(job: CommandJob, context: OperationContext = {}): OperationRecord {
  const endedAt = job.endedAt ?? Date.now();
  return {
    id: job.id,
    kind: classifyOperation(job.command),
    command: job.command,
    origin: job.origin,
    status: operationStatus(job),
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    durationMs: job.startedAt ? Math.max(0, endedAt - job.startedAt) : null,
    targetUid: context.targetUid || undefined,
    targetType: context.targetType || undefined,
    transport: context.transport,
    phase: job.progress?.phase,
    progress: job.progress?.percent,
    summary: job.resultSummary,
    recovery: job.recovery,
    outputTail: job.outputTail.slice(-50),
    updatedAt: endedAt,
  };
}
