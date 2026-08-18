import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  FileText,
  Plus,
  Radio,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PanelHeader } from "@/components/panels/shared/PanelHeader";
import type { CachedDump, PM3DumpJson } from "@/features/memory/types";
import { useCommands } from "@/features/commands/context";
import type { CommandJob } from "@/features/commands/types";
import { useDeviceProfile } from "@/features/device/context";
import { loadSettingsFromStorage } from "@/features/settings/storage";
import { type2Options } from "@/features/operations/profiles";
import {
  bytesToBase64,
  exportOperationReport,
  makeOperationId,
} from "@/features/operations/report";
import { putBackup, putOperation } from "@/features/vault/operations";
import { useVaultBackups, useVaultOperations } from "@/features/vault/hooks";
import type { BackupRecord, OperationCheckRecord, OperationRecord } from "@/features/vault/db";
import { ensureFsDirectory, readFsBytes } from "@/lib/emscriptenFs";
import { dumpImportInternals } from "@/features/memory/lib/import";
import { buildNdefTlv, parseNdefMessage, type NdefField } from "@/features/type2/ndef";
import { bytesToHex, parseMfuBytes, parseMfuJson, type ParsedMfuDump } from "@/features/type2/mfu";
import {
  buildWriteCommands,
  hasBlockingChecks,
  planType2Erase,
  planType2Write,
  protectedPagesUnchanged,
  type2Preflight,
  verifyTargetArea,
  type Type2WritePlan,
} from "@/features/type2/workflow";

const CACHE_DIR = "/pm3-cache";

interface Type2NdefPanelProps {
  activeDump: CachedDump | null;
  onDumpLoad?: (dump: PM3DumpJson, name: string) => void;
  disabled?: boolean;
}

function initialFields(): NdefField[] {
  return [
    { id: makeOperationId("field"), name: "Label", value: "", writeName: false, kind: "text" },
    {
      id: makeOperationId("field"),
      name: "Link",
      value: "https://",
      writeName: false,
      kind: "uri",
    },
  ];
}

function checkIcon(state: OperationCheckRecord["state"]) {
  if (state === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (state === "error") return <XCircle className="h-4 w-4 text-destructive" />;
  return <TriangleAlert className="h-4 w-4 text-amber-500" />;
}

function commandFailed(job: CommandJob): boolean {
  return job.status === "stopped" || job.resultKind === "failure";
}

export function Type2NdefPanel({ activeDump, onDumpLoad, disabled = false }: Type2NdefPanelProps) {
  const commands = useCommands();
  const { profile: device } = useDeviceProfile();
  const reports = useVaultOperations().filter((item) => item.workflow?.startsWith("type2"));
  const backups = useVaultBackups().filter((item) => item.kind === "type2");
  const [fields, setFields] = useState<NdefField[]>(initialFields);
  const [snapshot, setSnapshot] = useState<ParsedMfuDump | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Load an MFU dump or connect a tag to begin.");
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<OperationRecord | null>(null);
  const [pending, setPending] = useState<"write" | "clear" | "zero" | null>(null);

  useEffect(() => {
    if (!activeDump?.data?.blocks) return;
    try {
      const parsed = parseMfuJson(activeDump.data);
      if (
        parsed.profile ||
        Object.values(activeDump.data.blocks).every(
          (value) => value.replace(/\s/g, "").length === 8,
        )
      )
        setSnapshot(parsed);
    } catch {
      // A Classic dump can remain active while this workspace is open.
    }
  }, [activeDump]);

  const decoded = useMemo(() => {
    if (!snapshot?.ndefMessage) return [];
    try {
      return parseNdefMessage(snapshot.ndefMessage);
    } catch {
      return [];
    }
  }, [snapshot]);

  const preview = useMemo(() => {
    if (!snapshot?.profile)
      return { bytes: 0, error: "Detect a supported tag to calculate capacity." };
    try {
      const tlv = buildNdefTlv(fields, snapshot.profile.ndefCapacity);
      return { bytes: tlv.length, remaining: snapshot.profile.ndefCapacity - tlv.length };
    } catch (previewError) {
      return {
        bytes: 0,
        error: previewError instanceof Error ? previewError.message : "Invalid NDEF fields.",
      };
    }
  }, [fields, snapshot?.profile]);

  const readLive = useCallback(
    async (
      label: string,
      persist = false,
    ): Promise<{ parsed: ParsedMfuDump; bytes: Uint8Array; name: string }> => {
      ensureFsDirectory(CACHE_DIR);
      const name = `web-type2-${label}-${Date.now()}.bin`;
      const path = `${CACHE_DIR}/${name}`;
      const job = await commands.runAndWait(`hf mfu dump -f ${path}`, `type2-${label}`, 180_000);
      if (commandFailed(job))
        throw new Error(job.resultSummary ?? "The Type 2 dump command failed.");
      const bytes = readFsBytes(path);
      const parsed = parseMfuBytes(bytes);
      if (persist) {
        const imported = dumpImportInternals.mfuDumpFromBytes(bytes, name);
        onDumpLoad?.(imported.dump, name);
      }
      return { parsed, bytes, name };
    },
    [commands, onDumpLoad],
  );

  const handleRead = useCallback(async () => {
    setBusy(true);
    setError(null);
    setStatus("Reading the complete Type 2 memory image…");
    try {
      const live = await readLive("read", true);
      setSnapshot(live.parsed);
      setStatus(
        live.parsed.ndefMessage
          ? `Read ${live.parsed.ndefMessage.length} NDEF bytes from ${live.parsed.profile?.name ?? "Type 2 tag"}.`
          : "The tag has no NDEF message.",
      );
      const now = Date.now();
      const readReport: OperationRecord = {
        id: makeOperationId(),
        kind: "read",
        command: "hf mfu dump",
        origin: "type2",
        status: "succeeded",
        queuedAt: now,
        startedAt: now,
        endedAt: now,
        durationMs: 0,
        targetUid: bytesToHex(live.parsed.uid),
        targetType: live.parsed.profile?.name,
        outputTail: [],
        updatedAt: now,
        workflow: "type2-read",
        verified: true,
        checks: type2Preflight(live.parsed, type2Options("recommended")),
      };
      setReport(readReport);
      await putOperation(readReport);
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Could not read the Type 2 tag.");
    } finally {
      setBusy(false);
    }
  }, [readLive]);

  const runBatches = useCallback(
    async (pages: Type2WritePlan["changedPages"], output: string[]) => {
      const batches = buildWriteCommands(pages);
      for (let index = 0; index < batches.length; index++) {
        setStatus(`Writing batch ${index + 1} of ${batches.length}…`);
        const job = await commands.runAndWait(batches[index], "type2-write", 180_000);
        output.push(...job.outputTail);
        if (commandFailed(job))
          throw new Error(job.resultSummary ?? `Write batch ${index + 1} failed.`);
      }
    },
    [commands],
  );

  const execute = useCallback(
    async (kind: "write" | "clear" | "zero") => {
      setPending(null);
      setBusy(true);
      setError(null);
      const settings = loadSettingsFromStorage();
      const options = type2Options(settings.operationProfile);
      const id = makeOperationId();
      const startedAt = Date.now();
      const workflow =
        kind === "write" ? "type2-write" : kind === "clear" ? "type2-clear" : "type2-zero";
      const output: string[] = [];
      let checks: OperationCheckRecord[] = [];
      let backupId: string | undefined;
      try {
        setStatus("Capturing a current baseline dump…");
        const baseline = await readLive("before");
        setSnapshot(baseline.parsed);
        checks = type2Preflight(baseline.parsed, options);
        if (options.checkDevice) {
          checks.unshift({
            id: "device",
            label: "Client and firmware",
            state:
              device.firmwareCompatible === false
                ? "error"
                : device.firmwareCompatible === true
                  ? "ok"
                  : "warning",
            detail:
              device.firmwareCompatible === false
                ? "Client and firmware evidence indicates a mismatch."
                : device.firmwareCompatible === true
                  ? "Client and firmware commits match."
                  : "A firmware match could not be established; continuing with tag-level safety checks.",
            blocking: device.firmwareCompatible === false,
          });
        }
        if (hasBlockingChecks(checks))
          throw new Error("Preflight found a blocking protection or compatibility condition.");

        if (options.backup) {
          backupId = makeOperationId("backup");
          const backup: BackupRecord = {
            id: backupId,
            name: `type2-before-${bytesToHex(baseline.parsed.uid)}-${startedAt}.bin`,
            kind: "type2",
            uid: bytesToHex(baseline.parsed.uid),
            operationId: id,
            mimeType: "application/octet-stream",
            base64: bytesToBase64(baseline.bytes),
            size: baseline.bytes.length,
            createdAt: Date.now(),
          };
          await putBackup(backup);
          checks.push({
            id: "backup",
            label: "Browser backup",
            state: "ok",
            detail: `Saved ${backup.size} bytes to the browser vault.`,
            blocking: false,
          });
        }

        let stable = baseline;
        if (options.targetStability) {
          setStatus("Confirming the same tag is still present…");
          stable = await readLive("stability");
          const same = bytesToHex(stable.parsed.uid) === bytesToHex(baseline.parsed.uid);
          checks.push({
            id: "stability",
            label: "Target stability",
            state: same ? "ok" : "error",
            detail: same
              ? "The UID remained stable across baseline reads."
              : "The tag UID changed before writing.",
            blocking: !same,
          });
          if (!same) throw new Error("The target tag changed before writing.");
        }

        let plan: Type2WritePlan;
        if (kind === "write") {
          if (!stable.parsed.profile) throw new Error("No writable Type 2 profile was detected.");
          plan = planType2Write(
            stable.parsed,
            buildNdefTlv(fields, stable.parsed.profile.ndefCapacity),
            options,
          );
        } else {
          plan = planType2Erase(stable.parsed, kind === "clear" ? "ndef" : "user");
        }
        checks.push({
          id: "plan",
          label: "Bounded write plan",
          state: "ok",
          detail: `${plan.changedPages.length} changed page${plan.changedPages.length === 1 ? "" : "s"}; writes are restricted to the detected ${plan.profile.name} user range.`,
          blocking: false,
        });

        if (plan.changedPages.length > 0) {
          if (plan.invalidate) await runBatches([plan.invalidate], output);
          await runBatches(plan.bodyPages, output);
          if (options.precommitVerify && plan.invalidate) {
            const precommit = await readLive("precommit");
            const bodyOk = plan.bodyPages.every(({ page, data }) =>
              data.every((byte, index) => precommit.parsed.pages[page * 4 + index] === byte),
            );
            checks.push({
              id: "precommit",
              label: "Pre-commit body verification",
              state: bodyOk ? "ok" : "error",
              detail: bodyOk
                ? "Every staged body page matched before commit."
                : "The staged body did not match.",
              blocking: !bodyOk,
            });
            if (!bodyOk)
              throw new Error(
                "Pre-commit verification failed; the NDEF header remains invalidated.",
              );
          }
          if (plan.commit) await runBatches([plan.commit], output);
        } else {
          checks.push({
            id: "no-change",
            label: "Write",
            state: "skipped",
            detail: "The requested target state already matches the tag.",
            blocking: false,
          });
        }

        let finalSnapshot = stable.parsed;
        let verified = false;
        if (options.finalVerify) {
          setStatus("Reading back and verifying exact bytes…");
          finalSnapshot = (await readLive("verify", true)).parsed;
          const contentOk = verifyTargetArea(finalSnapshot, plan);
          const protectedOk =
            !options.protectedVerify ||
            protectedPagesUnchanged(stable.parsed, finalSnapshot, plan.profile);
          verified = contentOk && protectedOk;
          checks.push({
            id: "readback",
            label: "Post-write comparison",
            state: verified ? "ok" : "error",
            detail: verified
              ? "Target bytes match and protected memory remained unchanged."
              : "Readback or protected-page comparison failed.",
            blocking: !verified,
          });
          if (!verified) throw new Error("Final byte-for-byte verification failed.");
        }
        setSnapshot(finalSnapshot);
        const endedAt = Date.now();
        const completed: OperationRecord = {
          id,
          kind: kind === "write" ? "write" : "erase",
          command: workflow,
          origin: "type2",
          status: "succeeded",
          queuedAt: startedAt,
          startedAt,
          endedAt,
          durationMs: endedAt - startedAt,
          targetUid: bytesToHex(finalSnapshot.uid),
          targetType: plan.profile.name,
          phase: "complete",
          progress: 100,
          summary: verified
            ? "Operation completed and verified byte for byte."
            : "Operation completed without final verification.",
          outputTail: output.slice(-200),
          updatedAt: endedAt,
          workflow,
          profile: options.profile,
          method: "page-write",
          checks,
          backupId,
          verified,
          affectedPages: plan.changedPages.map((item) => item.page),
        };
        await putOperation(completed);
        setReport(completed);
        setStatus(completed.summary ?? "Complete.");
      } catch (workflowError) {
        const endedAt = Date.now();
        const message =
          workflowError instanceof Error ? workflowError.message : "Type 2 operation failed.";
        const failed: OperationRecord = {
          id,
          kind: kind === "write" ? "write" : "erase",
          command: workflow,
          origin: "type2",
          status: "failed",
          queuedAt: startedAt,
          startedAt,
          endedAt,
          durationMs: endedAt - startedAt,
          phase: "failed",
          summary: message,
          outputTail: output.slice(-200),
          updatedAt: endedAt,
          workflow,
          profile: options.profile,
          method: "page-write",
          checks,
          backupId,
          verified: false,
        };
        await putOperation(failed);
        setReport(failed);
        setError(message);
        setStatus("Operation stopped safely.");
      } finally {
        setBusy(false);
      }
    },
    [device.firmwareCompatible, fields, readLive, runBatches],
  );

  const updateField = (id: string, patch: Partial<NdefField>) =>
    setFields((current) =>
      current.map((field) => (field.id === id ? { ...field, ...patch } : field)),
    );
  const moveField = (index: number, delta: number) =>
    setFields((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <PanelHeader
        icon={Radio}
        title="NFC Type 2 / NDEF"
        tag={snapshot?.profile?.name ?? "Read-only until detected"}
        actions={
          <Button size="sm" variant="outline" onClick={handleRead} disabled={disabled || busy}>
            <Download className="mr-1 h-3 w-3" />
            Read tag
          </Button>
        }
      />
      <CardContent className="min-h-0 flex-1 overflow-auto p-4">
        <Tabs defaultValue="editor">
          <TabsList>
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="read">Decoded NDEF</TabsTrigger>
            <TabsTrigger value="report">Checks & report</TabsTrigger>
            <TabsTrigger value="history">Vault history</TabsTrigger>
          </TabsList>
          <TabsContent value="editor" className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{status}</div>
              {error ? <div className="mt-1 text-destructive">{error}</div> : null}
            </div>
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid gap-2 rounded-md border p-2 md:grid-cols-[4rem_9rem_1fr_auto_auto] md:items-center"
                >
                  <Badge variant="outline">{index + 1}</Badge>
                  <Input
                    value={field.name}
                    onChange={(event) => updateField(field.id, { name: event.target.value })}
                    aria-label="Field name"
                  />
                  <Input
                    value={field.value}
                    onChange={(event) => updateField(field.id, { value: event.target.value })}
                    aria-label="Field value"
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={field.writeName}
                      disabled={field.kind === "uri"}
                      onChange={(event) =>
                        updateField(field.id, { writeName: event.target.checked })
                      }
                    />
                    Write name
                  </label>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => moveField(index, -1)}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => moveField(index, 1)}
                      disabled={index === fields.length - 1}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setFields((current) => current.filter((item) => item.id !== field.id))
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setFields((current) => [
                    ...current,
                    {
                      id: makeOperationId("field"),
                      name: "Text",
                      value: "",
                      writeName: false,
                      kind: "text",
                    },
                  ])
                }
              >
                <Plus className="mr-1 h-3 w-3" />
                Text field
              </Button>
              <Button
                variant="outline"
                disabled={fields.some((field) => field.kind === "uri")}
                onClick={() =>
                  setFields((current) => [
                    ...current,
                    {
                      id: makeOperationId("field"),
                      name: "Link",
                      value: "https://",
                      writeName: false,
                      kind: "uri",
                    },
                  ])
                }
              >
                <Plus className="mr-1 h-3 w-3" />
                URI field
              </Button>
              <Badge variant={preview.error ? "destructive" : "secondary"}>
                {preview.error ?? `${preview.bytes} bytes · ${preview.remaining} remaining`}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button
                onClick={() => setPending("write")}
                disabled={disabled || busy || Boolean(preview.error)}
              >
                <Upload className="mr-1 h-4 w-4" />
                Write NDEF
              </Button>
              <Button variant="outline" onClick={handleRead} disabled={disabled || busy}>
                <ShieldCheck className="mr-1 h-4 w-4" />
                Check / Read NDEF
              </Button>
              <Button
                variant="outline"
                onClick={() => setPending("clear")}
                disabled={disabled || busy}
              >
                Clear NDEF content
              </Button>
              <Button
                variant="destructive"
                onClick={() => setPending("zero")}
                disabled={disabled || busy}
              >
                Zero user memory
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="read" className="space-y-3">
            {decoded.length ? (
              decoded.map((record, index) => (
                <div key={index} className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">
                    Record {index + 1} · TNF {record.tnf} ·{" "}
                    {new TextDecoder().decode(record.type) || "unknown"}
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap text-sm">
                    {record.decoded ?? bytesToHex(record.payload)}
                  </pre>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No decoded NDEF records are loaded.
              </div>
            )}
          </TabsContent>
          <TabsContent value="report">
            {report ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{report.summary}</div>
                    <div className="text-xs text-muted-foreground">
                      {report.workflow} · {report.profile}
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => exportOperationReport(report)}>
                    <FileText className="mr-1 h-3 w-3" />
                    Export JSON
                  </Button>
                </div>
                <div className="divide-y rounded-md border">
                  {report.checks?.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[1.25rem_12rem_1fr] gap-2 p-2 text-sm"
                    >
                      {checkIcon(item.state)}
                      <span className="font-medium">{item.label}</span>
                      <span className="text-muted-foreground">{item.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Run a check or workflow to produce a report.
              </div>
            )}
          </TabsContent>
          <TabsContent value="history" className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-medium">Recent reports</h3>
              {reports.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setReport(item)}
                  className="mb-1 flex w-full items-center justify-between rounded-md border p-2 text-left text-xs hover:bg-accent"
                >
                  <span>
                    {item.workflow} · {item.summary}
                  </span>
                  <Badge variant={item.status === "succeeded" ? "success" : "destructive"}>
                    {item.status}
                  </Badge>
                </button>
              ))}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">Browser backups</h3>
              {backups.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="mb-1 flex items-center justify-between rounded-md border p-2 text-xs"
                >
                  <span>{item.name}</span>
                  <span className="text-muted-foreground">{item.size} B</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <ConfirmDialog
        open={pending !== null}
        title={
          pending === "write"
            ? "Write NDEF content?"
            : pending === "clear"
              ? "Clear only the NDEF TLV?"
              : "Zero the complete supported user area?"
        }
        description="The selected safety profile will detect the memory layout, inspect locks, save a browser backup when configured, bound every page write, and verify the result."
        confirmLabel={pending === "zero" ? "Zero user memory" : "Continue"}
        destructive={pending !== "write"}
        onConfirm={() => pending && void execute(pending)}
        onClose={() => setPending(null)}
      />
    </Card>
  );
}

export default Type2NdefPanel;
