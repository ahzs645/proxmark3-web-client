import type { CommandJob } from "@/features/commands/types";
import type { OperationCheckRecord } from "@/features/vault/db";

export interface VerifiedOperationRunner {
  runAndWait: (command: string, origin?: string, timeoutMs?: number) => Promise<CommandJob>;
}

export interface VerifiedOperationStep {
  command: string;
  check: (output: string) => OperationCheckRecord[];
}

export interface VerifiedOperationPlan {
  origin: string;
  preflight?: VerifiedOperationStep;
  writeCommand: string;
  readback: VerifiedOperationStep;
  timeoutMs?: number;
}

export interface VerifiedOperationResult {
  jobs: CommandJob[];
  checks: OperationCheckRecord[];
  passed: boolean;
  summary: string;
}

function output(job: CommandJob): string {
  return job.outputTail.join("\n");
}

function failed(job: CommandJob): boolean {
  return job.status === "stopped" || job.resultKind === "failure";
}

function hasBlockingFailure(checks: OperationCheckRecord[]): boolean {
  return checks.some((item) => item.blocking && item.state === "error");
}

function commandCheck(id: string, label: string, job: CommandJob): OperationCheckRecord {
  const commandFailed = failed(job);
  return {
    id,
    label,
    state: commandFailed ? "error" : "ok",
    detail: commandFailed
      ? (job.resultSummary ?? "The PM3 client did not complete this command.")
      : "The PM3 client completed the command.",
    blocking: true,
  };
}

/**
 * Execute preflight → write → read-back without allowing a later step to run
 * after a blocking failure. Hardware-specific comparison remains in the plan.
 */
export async function executeVerifiedOperation(
  runner: VerifiedOperationRunner,
  plan: VerifiedOperationPlan,
  onStage?: (stage: "preflight" | "writing" | "verifying") => void,
): Promise<VerifiedOperationResult> {
  const jobs: CommandJob[] = [];
  const checks: OperationCheckRecord[] = [];
  const timeout = plan.timeoutMs ?? 120_000;

  if (plan.preflight) {
    onStage?.("preflight");
    const job = await runner.runAndWait(plan.preflight.command, plan.origin, timeout);
    jobs.push(job);
    checks.push(commandCheck("preflight-command", "Preflight command", job));
    if (!failed(job)) checks.push(...plan.preflight.check(output(job)));
    if (hasBlockingFailure(checks)) {
      const detail = checks.find((item) => item.blocking && item.state === "error")?.detail;
      return { jobs, checks, passed: false, summary: detail ?? "Preflight checks failed." };
    }
  }

  onStage?.("writing");
  const write = await runner.runAndWait(plan.writeCommand, plan.origin, timeout);
  jobs.push(write);
  checks.push(commandCheck("write-command", "Write command", write));
  if (failed(write)) {
    return {
      jobs,
      checks,
      passed: false,
      summary: write.resultSummary ?? "The write command failed.",
    };
  }

  onStage?.("verifying");
  const readback = await runner.runAndWait(plan.readback.command, plan.origin, timeout);
  jobs.push(readback);
  checks.push(commandCheck("readback-command", "Read-back command", readback));
  if (!failed(readback)) checks.push(...plan.readback.check(output(readback)));
  const passed = !hasBlockingFailure(checks);
  const failedLabels = checks
    .filter((item) => item.blocking && item.state === "error")
    .map((item) => item.label);
  return {
    jobs,
    checks,
    passed,
    summary: passed
      ? "Write completed and read-back verification passed."
      : `Verification failed: ${failedLabels.join(", ")}.`,
  };
}
