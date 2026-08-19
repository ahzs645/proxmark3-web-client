import { useMemo, useState } from "react";
import { CircleAlert, CircleCheck, Loader2, Radar, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCommands } from "@/features/commands/context";
import { parseMagicInfo } from "@/features/magic/detect";
import { parseUidFromHfOutput } from "@/features/magic/verified";
import { dumpBytes } from "@/features/memory/lib/export";
import { equalBytes, magicSizeFlag, planMagicRestore } from "@/features/memory/lib/magicRestore";
import type { CachedDump } from "@/features/memory/types";
import { bytesToBase64, makeOperationId } from "@/features/operations/report";
import { useTarget } from "@/features/target/context";
import type { OperationCheckRecord, OperationRecord } from "@/features/vault/db";
import { putBackup, putOperation } from "@/features/vault/operations";
import { ensureFsDirectory, readFsBytes } from "@/lib/emscriptenFs";

interface MagicRestorePipelineProps {
  activeDump: CachedDump;
  disabled?: boolean;
}

type RestoreStage = "idle" | "preflight" | "backup" | "write" | "verify" | "done" | "failed";

function cleanHex(value?: string): string {
  return (value ?? "").replace(/[^0-9A-F]/gi, "").toUpperCase();
}

function commandFailed(job: { status: string; resultKind: string }): boolean {
  return job.status === "stopped" || job.resultKind === "failure";
}

export function MagicRestorePipeline({ activeDump, disabled = false }: MagicRestorePipelineProps) {
  const commands = useCommands();
  const { target } = useTarget();
  const plan = useMemo(() => planMagicRestore(activeDump.data, target), [activeDump.data, target]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [directConfirmOpen, setDirectConfirmOpen] = useState(false);
  const [stage, setStage] = useState<RestoreStage>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const busy = !["idle", "done", "failed"].includes(stage);
  const planLabel =
    plan.state === "ready"
      ? "guard ready"
      : plan.state === "needs-scan"
        ? "guard needs scan"
        : plan.state === "needs-detect"
          ? "guard needs detection"
          : "guard unavailable";
  const directSource = useMemo(() => {
    if (!plan.sourceSize) return null;
    try {
      const bytes = dumpBytes(activeDump.data);
      const expectedLength = plan.sourceSize === "4k" ? 4096 : 1024;
      return bytes.length === expectedLength ? { bytes, size: plan.sourceSize } : null;
    } catch {
      return null;
    }
  }, [activeDump.data, plan.sourceSize]);

  const runRestore = async () => {
    setConfirmOpen(false);
    const currentPlan = planMagicRestore(activeDump.data, target);
    if (currentPlan.state !== "ready" || !currentPlan.sourceSize) {
      setStage("failed");
      setMessage(currentPlan.summary);
      return;
    }

    const sourceSize = currentPlan.sourceSize;
    const operationId = makeOperationId("magic-restore");
    const startedAt = Date.now();
    const sourceBytes = dumpBytes(activeDump.data);
    const sizeFlag = magicSizeFlag(sourceSize);
    const sourceUid = cleanHex(activeDump.data.Card?.UID);
    const targetUid = cleanHex(target.identity?.uid);
    const output: string[] = [];
    const checks: OperationCheckRecord[] = currentPlan.checks.map((check) => ({ ...check }));
    let backupId: string | undefined;

    const persist = async (
      status: OperationRecord["status"],
      summary: string,
      verified: boolean,
      phase: OperationRecord["phase"],
    ) => {
      const endedAt = Date.now();
      await putOperation({
        id: operationId,
        kind: "write",
        command: `hf mf cload ${sizeFlag}`,
        origin: "magic-dump-restore",
        status,
        queuedAt: startedAt,
        startedAt,
        endedAt,
        durationMs: endedAt - startedAt,
        targetUid: sourceUid,
        targetType: `Gen1a MIFARE Classic ${sourceSize.toUpperCase()}`,
        phase,
        progress: verified ? 100 : undefined,
        summary,
        outputTail: output.slice(-200),
        updatedAt: endedAt,
        workflow: "magic-dump-restore",
        method: "gen1a-csave-cload",
        checks,
        backupId,
        verified,
        affectedPages: Array.from({ length: currentPlan.sourceBlockCount }, (_, index) => index),
      });
    };

    try {
      setStage("preflight");
      setMessage("Re-checking the target UID and magic generation…");
      const infoJob = await commands.runAndWait("hf mf info", "magic-restore-preflight", 90_000);
      output.push(...infoJob.outputTail);
      const infoOutput = infoJob.outputTail.join("\n");
      const detectedMagic = parseMagicInfo(infoOutput);
      const detectedUid = parseUidFromHfOutput(infoOutput);
      const sameTarget = Boolean(detectedUid && detectedUid === targetUid);
      const stillGen1a = Boolean(detectedMagic?.isMagic && detectedMagic.gen === "gen1a");
      checks.push({
        id: "fresh-target",
        label: "Fresh target preflight",
        state: sameTarget && stillGen1a && !commandFailed(infoJob) ? "ok" : "error",
        detail:
          sameTarget && stillGen1a
            ? `Target ${detectedUid} is still present and reports ${detectedMagic?.label || "Gen1a"}.`
            : `Expected Gen1a target ${targetUid || "unknown"}; detected ${detectedUid || "no UID"} / ${detectedMagic?.label || "no magic capability"}.`,
        blocking: true,
      });
      if (commandFailed(infoJob) || !sameTarget || !stillGen1a) {
        throw new Error("Fresh target preflight failed; nothing was written.");
      }

      setStage("backup");
      setMessage("Reading an exact target backup before writing…");
      const backupBase = `/pm3-cache/magic-target-${targetUid || "card"}-${operationId}`;
      const backupJob = await commands.runAndWait(
        `hf mf csave ${sizeFlag} -f ${backupBase}`,
        "magic-restore-backup",
        240_000,
      );
      output.push(...backupJob.outputTail);
      if (commandFailed(backupJob))
        throw new Error("Target backup command failed; nothing was written.");
      const beforeBytes = readFsBytes(backupBase);
      if (beforeBytes.length !== sourceBytes.length) {
        throw new Error(
          `Target backup returned ${beforeBytes.length} bytes; expected ${sourceBytes.length}. Nothing was written.`,
        );
      }
      backupId = makeOperationId("backup");
      await putBackup({
        id: backupId,
        name: `magic-target-before-${targetUid || "card"}-${startedAt}.bin`,
        kind: "mifare",
        uid: targetUid,
        operationId,
        mimeType: "application/octet-stream",
        base64: bytesToBase64(beforeBytes),
        size: beforeBytes.length,
        createdAt: Date.now(),
      });
      checks.push({
        id: "target-backup",
        label: "Exact target backup",
        state: "ok",
        detail: `Captured ${beforeBytes.length} target bytes through the Gen1a backdoor before writing.`,
        blocking: true,
      });

      setStage("write");
      setMessage(`Writing all ${currentPlan.sourceBlockCount} blocks. Keep the target still…`);
      const fs = ensureFsDirectory("/pm3-cache");
      const sourcePath = `/pm3-cache/magic-source-${sourceUid || "dump"}-${operationId}.bin`;
      fs.writeFile!(sourcePath, sourceBytes, {
        flags: "w+",
      });
      const writeJob = await commands.runAndWait(
        `hf mf cload ${sizeFlag} -f ${sourcePath}`,
        "magic-dump-restore",
        300_000,
      );
      output.push(...writeJob.outputTail);
      if (commandFailed(writeJob))
        throw new Error("Gen1a cload failed; restore the saved target backup before retrying.");
      checks.push({
        id: "write-command",
        label: "Full-card write",
        state: "ok",
        detail: `PM3 accepted the ${currentPlan.sourceBlockCount}-block Gen1a cload operation.`,
        blocking: true,
      });

      setStage("verify");
      setMessage("Reading the entire target back for byte-for-byte comparison…");
      const verifyBase = `/pm3-cache/magic-verify-${sourceUid || "card"}-${operationId}`;
      const verifyJob = await commands.runAndWait(
        `hf mf csave ${sizeFlag} -f ${verifyBase}`,
        "magic-restore-verify",
        240_000,
      );
      output.push(...verifyJob.outputTail);
      if (commandFailed(verifyJob)) throw new Error("Post-write readback failed.");
      const readbackBytes = readFsBytes(verifyBase);
      const exact = equalBytes(sourceBytes, readbackBytes);
      checks.push({
        id: "exact-readback",
        label: "Exact full-card readback",
        state: exact ? "ok" : "error",
        detail: exact
          ? `All ${sourceBytes.length} bytes, including UID/block 0 and sector trailers, matched the source dump.`
          : `Read back ${readbackBytes.length} bytes, but the card image did not exactly match the ${sourceBytes.length}-byte source.`,
        blocking: true,
      });
      if (!exact) throw new Error("Full-card readback did not match the source dump.");

      const identifyJob = await commands.runAndWait(
        "hf 14a info",
        "magic-restore-identify",
        90_000,
      );
      output.push(...identifyJob.outputTail);
      setStage("done");
      const summary = `Verified ${sourceSize.toUpperCase()} Gen1a restore: ${sourceBytes.length} bytes matched exactly.`;
      setMessage(summary);
      await persist("succeeded", summary, true, "verified");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Magic-card restore failed.";
      setStage("failed");
      setMessage(detail);
      checks.push({
        id: "workflow",
        label: "Restore workflow",
        state: "error",
        detail,
        blocking: true,
      });
      await persist("failed", detail, false, "failed");
    }
  };

  const runDirectRestore = async () => {
    setDirectConfirmOpen(false);
    if (!directSource) {
      setStage("failed");
      setMessage("Direct write needs a contiguous 64-block (1K) or 256-block (4K) dump.");
      return;
    }

    const { bytes: sourceBytes, size: sourceSize } = directSource;
    const operationId = makeOperationId("magic-direct-restore");
    const startedAt = Date.now();
    const sourceUid = cleanHex(activeDump.data.Card?.UID);
    const sizeFlag = magicSizeFlag(sourceSize);
    const sourceBlockCount = sourceSize === "4k" ? 256 : 64;
    const output: string[] = [];
    const checks: OperationCheckRecord[] = [
      {
        id: "direct-write",
        label: "Guard bypassed",
        state: "warning",
        detail:
          "User explicitly chose a direct Gen1a cload without target detection, capacity checking, backup, or readback verification.",
        blocking: false,
      },
    ];

    const persist = async (status: OperationRecord["status"], summary: string) => {
      const endedAt = Date.now();
      await putOperation({
        id: operationId,
        kind: "write",
        command: `hf mf cload ${sizeFlag}`,
        origin: "magic-dump-restore-direct",
        status,
        queuedAt: startedAt,
        startedAt,
        endedAt,
        durationMs: endedAt - startedAt,
        targetUid: sourceUid,
        targetType: `Direct Gen1a MIFARE Classic ${sourceSize.toUpperCase()}`,
        phase: status === "failed" ? "failed" : "written-unverified",
        progress: status === "failed" ? undefined : 100,
        summary,
        outputTail: output.slice(-200),
        updatedAt: endedAt,
        workflow: "magic-dump-restore",
        method: "gen1a-direct-cload",
        checks,
        verified: false,
        affectedPages: Array.from({ length: sourceBlockCount }, (_, index) => index),
      });
    };

    try {
      setStage("write");
      setMessage(
        `Directly writing all ${sourceBlockCount} blocks without preflight or backup. Keep the target still…`,
      );
      const fs = ensureFsDirectory("/pm3-cache");
      const sourcePath = `/pm3-cache/magic-source-direct-${sourceUid || "dump"}-${operationId}.bin`;
      fs.writeFile!(sourcePath, sourceBytes, { flags: "w+" });
      const writeJob = await commands.runAndWait(
        `hf mf cload ${sizeFlag} -f ${sourcePath}`,
        "magic-dump-restore-direct",
        300_000,
      );
      output.push(...writeJob.outputTail);
      if (commandFailed(writeJob)) throw new Error("Direct Gen1a cload failed.");

      const summary = `Direct ${sourceSize.toUpperCase()} Gen1a write completed without readback verification.`;
      setStage("done");
      setMessage(summary);
      await persist("warning", summary);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Direct magic-card write failed.";
      checks.push({
        id: "write-command",
        label: "Direct full-card write",
        state: "error",
        detail,
        blocking: true,
      });
      setStage("failed");
      setMessage(detail);
      await persist("failed", detail);
    }
  };

  return (
    <div className="border-b bg-muted/15 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Optional guarded magic-card restore</h3>
            <Badge variant={plan.state === "ready" ? "success" : "secondary"}>{planLabel}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{plan.summary}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            The guarded path is recommended. Direct writing remains an explicit option when you
            intentionally want to bypass the gate.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.state === "needs-scan" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || commands.isBusy}
              onClick={() => void commands.runAndWait("hf search", "magic-restore-scan")}
            >
              <Radar className="mr-1 h-3.5 w-3.5" />
              Scan target
            </Button>
          ) : null}
          {plan.state === "needs-detect" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || commands.isBusy}
              onClick={() => void commands.runAndWait("hf mf info", "magic-restore-detect")}
            >
              <Radar className="mr-1 h-3.5 w-3.5" />
              Detect magic generation
            </Button>
          ) : null}
          {plan.state === "ready" ? (
            <Button
              size="sm"
              disabled={disabled || commands.isBusy || busy}
              onClick={() => setConfirmOpen(true)}
            >
              {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Backup → Write → Verify
            </Button>
          ) : null}
          {directSource ? (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || commands.isBusy || busy}
              onClick={() => setDirectConfirmOpen(true)}
            >
              Direct Gen1a write
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
        {plan.checks.map((check) => (
          <div
            key={check.id}
            className="flex items-start gap-2 rounded-md border bg-background p-2 text-xs"
          >
            {check.state === "ok" ? (
              <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
            ) : (
              <CircleAlert
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${check.state === "error" ? "text-destructive" : "text-amber-600"}`}
              />
            )}
            <span>
              <strong>{check.label}:</strong> {check.detail}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Next: {plan.nextStep}</p>
      {message ? (
        <div
          className={`mt-2 rounded-md border px-3 py-2 text-xs ${
            stage === "done"
              ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300"
              : stage === "failed"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-primary/30 bg-primary/5"
          }`}
        >
          {message}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title={`Restore ${plan.sourceBlockCount} blocks to this Gen1a target?`}
        description="The workflow first saves an exact backdoor read of the target, then writes every source block—including UID/block 0 and trailers—and finally reads the full card back for byte-for-byte verification. Keep only the intended target on the HF antenna."
        confirmLabel="Backup and restore"
        destructive
        onConfirm={() => void runRestore()}
        onClose={() => setConfirmOpen(false)}
      />
      <ConfirmDialog
        open={directConfirmOpen}
        title={`Directly write ${plan.sourceBlockCount} blocks?`}
        description="This sends the selected Library image through Gen1a cload immediately. It deliberately skips physical-target detection, magic-generation and capacity checks, target backup, and readback verification. Use it only when you already know the destination is a matching-capacity Gen1a card."
        confirmLabel="Write without guard"
        destructive
        onConfirm={() => void runDirectRestore()}
        onClose={() => setDirectConfirmOpen(false)}
      />
    </div>
  );
}
