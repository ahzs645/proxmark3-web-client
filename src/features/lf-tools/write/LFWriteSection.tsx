import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Play,
  Radar,
  ScanSearch,
  ShieldCheck,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCommands } from "@/features/commands/context";
import { useTarget } from "@/features/target/context";
import { useVaultLfCards } from "@/features/vault/hooks";
import { makeVaultId, putOperation } from "@/features/vault/operations";
import { SectionLabel } from "../shared";
import { buildEm4x05InfoCommand, buildT55xxBlankProbeCommand } from "../commands";
import type { LfTech } from "@/features/vault/db";
import { lfCardToForm, type ParsedLfCredential } from "../lfParse";
import {
  buildRegisteredLfClone,
  buildRegisteredLfSimulation,
  describeLfCredential,
  LF_FORMATS_BY_TECH,
} from "../formats";
import { executeVerifiedLfWrite, inspectLfBlank } from "./pipeline";
import type { LfBlankValidation, LfCredentialVerification } from "./verification";

interface LFWriteSectionProps {
  onCommand: (cmd: string) => void;
  disabled?: boolean;
}

const MANUAL = "__manual__";
type WorkflowStage =
  | "idle"
  | "validating"
  | "ready"
  | "writing"
  | "verifying"
  | "succeeded"
  | "failed";

/**
 * Write a saved (or hand-entered) LF credential onto a card, through the UI.
 * Enforces the "identify first" flow the way a careful clone should: it runs
 * `lf t55xx detect` and surfaces whether the carrier is a writable T5577 before
 * the write button arms.
 */
export function LFWriteSection({ onCommand, disabled = false }: LFWriteSectionProps) {
  const { target } = useTarget();
  const commands = useCommands();
  const lfCards = useVaultLfCards();

  const [selectedId, setSelectedId] = useState<string>(MANUAL);
  const [tech, setTech] = useState<LfTech>("hid");
  const [format, setFormat] = useState("H10301");
  const [fc, setFc] = useState("");
  const [cn, setCn] = useState("");
  const [emId, setEmId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);
  const [stage, setStage] = useState<WorkflowStage>("idle");
  const [blankValidation, setBlankValidation] = useState<LfBlankValidation | null>(null);
  const [verification, setVerification] = useState<LfCredentialVerification | null>(null);
  const [workflowMessage, setWorkflowMessage] = useState("");

  // As soon as a fresh read lands in the vault (newest-first), select it so the
  // write options for the just-identified card appear without an extra click.
  const newestId = lfCards[0]?.id;
  const newestToken = newestId ? `${newestId}:${lfCards[0]?.updatedAt}` : undefined;
  const lastAutoSelectedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!newestId || !newestToken || lastAutoSelectedRef.current === newestToken) return;
    lastAutoSelectedRef.current = newestToken;
    setSelectedId(newestId);
    setConfirmed(false);
  }, [newestId, newestToken]);

  // When a saved card is picked, load its fields into the form.
  useEffect(() => {
    if (selectedId === MANUAL) return;
    const card = lfCards.find((c) => c.id === selectedId);
    if (!card) return;
    setTech(card.tech);
    if (card.format) setFormat(card.format);
    setFc(card.facilityCode != null ? String(card.facilityCode) : "");
    setCn(card.cardNumber != null ? String(card.cardNumber) : "");
    if (card.tech === "em410x" && card.raw) setEmId(card.raw);
  }, [selectedId, lfCards]);

  const cardOptions = useMemo(
    () => [
      { value: MANUAL, label: "Manual entry" },
      ...lfCards.map((c) => ({ value: c.id, label: c.name })),
    ],
    [lfCards],
  );

  const selectedCard = useMemo(
    () => (selectedId === MANUAL ? null : (lfCards.find((card) => card.id === selectedId) ?? null)),
    [lfCards, selectedId],
  );

  const manualCredential = useMemo<ParsedLfCredential | null>(() => {
    if (tech === "hid" && format && /^\d+$/.test(fc) && /^\d+$/.test(cn)) {
      return {
        tech,
        format,
        facilityCode: Number(fc),
        cardNumber: Number(cn),
        name: `HID ${format} FC ${fc} CN ${cn}`,
      };
    }
    if (tech === "em410x" && /^[0-9A-F]{10}$/i.test(emId)) {
      return { tech, raw: emId.toUpperCase(), name: `EM410x ${emId.toUpperCase()}` };
    }
    return null;
  }, [cn, emId, fc, format, tech]);

  const expectedCredential = useMemo<ParsedLfCredential | null>(
    () => (selectedCard ? lfCardToForm(selectedCard) : manualCredential),
    [manualCredential, selectedCard],
  );

  const writeCommand = useMemo(() => {
    return expectedCredential ? buildRegisteredLfClone(expectedCredential) : null;
  }, [expectedCredential]);

  const simCommand = useMemo(
    () => (expectedCredential ? buildRegisteredLfSimulation(expectedCredential) : null),
    [expectedCredential],
  );

  const lf = target.lf;
  const identified = Boolean(lf);
  const detectFailed = Boolean(lf?.error);
  const writable = lf?.writable ?? false;
  const workflowBusy = stage === "validating" || stage === "writing" || stage === "verifying";
  const needsOverwriteConfirmation = Boolean(blankValidation?.existingCredential);
  const canWrite =
    !disabled &&
    !workflowBusy &&
    !commands.isBusy &&
    Boolean(writeCommand && expectedCredential) &&
    confirmed &&
    blankValidation?.ready === true &&
    (!needsOverwriteConfirmation || overwriteConfirmed);

  // Never carry an armed write across a fresh carrier check.
  useEffect(() => {
    setConfirmed(false);
    setOverwriteConfirmed(false);
  }, [lf?.at]);

  // A result belongs to the exact source fields that were written. Editing the
  // source clears that result and requires the destructive action to be re-armed.
  useEffect(() => {
    setConfirmed(false);
    setVerification(null);
    setStage((current) => (current === "succeeded" || current === "failed" ? "idle" : current));
  }, [tech, format, fc, cn, emId]);

  const handleIdentify = async () => {
    if (disabled || commands.isBusy || workflowBusy) return;
    setStage("validating");
    setWorkflowMessage("Detecting the carrier and checking for existing LF data…");
    setBlankValidation(null);
    setVerification(null);
    setConfirmed(false);
    setOverwriteConfirmed(false);
    try {
      const result = await inspectLfBlank(commands);
      setBlankValidation(result.validation);
      if (result.validation.ready) {
        setStage("ready");
        setWorkflowMessage(
          result.validation.existingCredential
            ? "Writable carrier validated. Existing data requires explicit overwrite confirmation."
            : "Writable carrier validated and ready for a verified write.",
        );
      } else {
        setStage("failed");
        setWorkflowMessage(
          result.validation.checks.find((item) => item.blocking && item.state === "error")
            ?.detail ?? "Carrier validation failed.",
        );
      }
    } catch (error) {
      setStage("failed");
      setWorkflowMessage(error instanceof Error ? error.message : "Carrier validation failed.");
    }
  };
  const handleBlankProbe = () => onCommand(buildT55xxBlankProbeCommand());
  const handleEm4x05Probe = () => onCommand(buildEm4x05InfoCommand());

  const handleWrite = async () => {
    if (!canWrite || !writeCommand || !expectedCredential || !blankValidation) return;
    const operationId = makeVaultId("lf-write");
    const startedAt = Date.now();
    setVerification(null);
    setWorkflowMessage("Writing credential. Keep the carrier still on the LF antenna.");

    try {
      const result = await executeVerifiedLfWrite(
        commands,
        expectedCredential,
        writeCommand,
        (nextStage) => {
          setStage(nextStage);
          setWorkflowMessage(
            nextStage === "writing"
              ? "Writing credential. Keep the carrier still on the LF antenna."
              : "Reading the carrier back and comparing credential fields…",
          );
        },
      );
      const endedAt = Date.now();
      setVerification(result.verification);
      setStage(result.verification.passed ? "succeeded" : "failed");
      setWorkflowMessage(result.verification.summary);
      setConfirmed(false);
      setOverwriteConfirmed(false);

      void putOperation({
        id: operationId,
        kind: "write",
        command: writeCommand,
        origin: "lf-verified-write",
        status: result.verification.passed ? "succeeded" : "failed",
        queuedAt: startedAt,
        startedAt: result.jobs[0]?.startedAt ?? startedAt,
        endedAt,
        durationMs: endedAt - startedAt,
        targetUid: expectedCredential.raw ?? expectedCredential.name,
        targetType: expectedCredential.name,
        phase: "verifying",
        progress: 100,
        summary: result.verification.summary,
        outputTail: result.jobs.flatMap((job) => job.outputTail).slice(-100),
        updatedAt: endedAt,
        workflow: "lf-verified-write",
        method: expectedCredential.tech,
        checks: [...blankValidation.checks, ...result.verification.checks],
        verified: result.verification.passed,
      });
    } catch (error) {
      const endedAt = Date.now();
      const detail = error instanceof Error ? error.message : "Verified LF write failed.";
      setStage("failed");
      setWorkflowMessage(detail);
      setConfirmed(false);
      void putOperation({
        id: operationId,
        kind: "write",
        command: writeCommand,
        origin: "lf-verified-write",
        status: "failed",
        queuedAt: startedAt,
        startedAt,
        endedAt,
        durationMs: endedAt - startedAt,
        targetType: expectedCredential.name,
        summary: detail,
        outputTail: [],
        updatedAt: endedAt,
        workflow: "lf-verified-write",
        method: expectedCredential.tech,
        checks: [
          ...blankValidation.checks,
          { id: "workflow", label: "Workflow", state: "error", detail, blocking: true },
        ],
        verified: false,
      });
    }
  };

  const handleSim = () => {
    if (simCommand) onCommand(simCommand);
  };

  return (
    <div className="space-y-3 p-3">
      <SectionLabel icon={<Upload className="h-3 w-3" />}>Write / Clone to card</SectionLabel>

      {/* Step 1 — validate the carrier and inspect it for existing data. */}
      <div className="space-y-2 rounded-md border border-border/60 p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium">1. Identify carrier</span>
          {workflowBusy && stage === "validating" ? (
            <Badge variant="secondary">validating…</Badge>
          ) : blankValidation ? (
            <Badge variant={blankValidation.ready ? "success" : "destructive"}>
              {blankValidation.ready ? "validated" : "blocked"}
            </Badge>
          ) : identified ? (
            <Badge variant={writable ? "success" : "warning"}>
              {detectFailed
                ? "detect failed"
                : `${lf?.chip ?? "unknown"}${writable ? " · writable" : " · not writable"}`}
            </Badge>
          ) : (
            <Badge variant="outline">not checked</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleIdentify()}
          disabled={disabled || commands.isBusy || workflowBusy}
          className="w-full gap-1"
        >
          {stage === "validating" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Radar className="h-3 w-3" />
          )}
          Validate carrier and existing data
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleBlankProbe}
            disabled={disabled || commands.isBusy || workflowBusy}
            className="gap-1 text-[11px]"
          >
            <ScanSearch className="h-3 w-3" />
            Probe blank T55xx
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleEm4x05Probe}
            disabled={disabled || commands.isBusy || workflowBusy}
            className="gap-1 text-[11px]"
          >
            <ScanSearch className="h-3 w-3" />
            Check EM4x05
          </Button>
        </div>
        {lf?.error ? (
          <p className="text-[11px] leading-tight text-amber-600 dark:text-amber-400">{lf.error}</p>
        ) : identified && !writable ? (
          <p className="text-[11px] leading-tight text-amber-600 dark:text-amber-400">
            No writable T5577/T5555 detected. Cloning needs a rewritable T55xx blank on the antenna.
          </p>
        ) : null}
        {lf?.passwordSet && (
          <p className="text-[11px] leading-tight text-amber-600 dark:text-amber-400">
            Carrier is password protected — the write may fail without the password.
          </p>
        )}
        <p className="text-[11px] leading-tight text-muted-foreground">
          LF cards do not use HF magic-card generations. A detected T55x7/T5555 or EM4x05 is the
          writable LF equivalent.
        </p>

        {blankValidation ? (
          <div className="space-y-1 border-t border-border/60 pt-2">
            {blankValidation.checks.map((item) => (
              <div key={item.id} className="flex items-start gap-1.5 text-[11px]">
                {item.state === "ok" ? (
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                ) : (
                  <TriangleAlert
                    className={`mt-0.5 h-3 w-3 shrink-0 ${item.state === "error" ? "text-destructive" : "text-amber-500"}`}
                  />
                )}
                <span>
                  <strong>{item.label}:</strong> {item.detail}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Step 2 — pick the credential to write. */}
      <div className="space-y-2 rounded-md border border-border/60 p-2">
        <span className="text-xs font-medium">2. Credential</span>
        <Select
          value={selectedId}
          onValueChange={setSelectedId}
          options={cardOptions}
          className="w-full"
        />

        {selectedCard && expectedCredential ? (
          <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {LF_FORMATS_BY_TECH.get(expectedCredential.tech)?.label ??
                  expectedCredential.tech.toUpperCase()}
              </Badge>
              <strong>{expectedCredential.name}</strong>
            </div>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {describeLfCredential(expectedCredential)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Captured fields are locked for this verified write. Choose Manual entry to compose a
              different HID or EM410x credential.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Select
                value={tech}
                onValueChange={(v) => setTech(v as LfTech)}
                options={[
                  { value: "hid", label: "HID Prox" },
                  { value: "em410x", label: "EM410x" },
                ]}
                className="w-32"
              />
              {tech === "hid" ? (
                <Input
                  value={format}
                  onChange={(e) =>
                    setFormat(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                  }
                  placeholder="H10301"
                  className="w-28 font-mono text-xs"
                />
              ) : null}
            </div>

            {tech === "hid" ? (
              <div className="flex items-center gap-2">
                <Input
                  value={fc}
                  onChange={(e) => setFc(e.target.value.replace(/\D/g, ""))}
                  placeholder="FC"
                  inputMode="numeric"
                  className="w-24 font-mono text-xs"
                />
                <Input
                  value={cn}
                  onChange={(e) => setCn(e.target.value.replace(/\D/g, ""))}
                  placeholder="Card number"
                  inputMode="numeric"
                  className="flex-1 font-mono text-xs"
                />
              </div>
            ) : (
              <Input
                value={emId}
                onChange={(e) =>
                  setEmId(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-F0-9]/g, "")
                      .slice(0, 10),
                  )
                }
                placeholder="EM410x ID (10 hex)"
                className="w-full font-mono text-xs"
                maxLength={10}
              />
            )}
          </>
        )}

        <code className="block truncate rounded bg-muted px-2 py-1 text-[11px]">
          {writeCommand ?? "enter a valid credential"}
        </code>
      </div>

      {/* Step 3 — arm, write, and require a structural read-back match. */}
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="h-3.5 w-3.5"
        />
        Validated carrier is still on the LF antenna
      </label>

      {needsOverwriteConfirmation ? (
        <label className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs">
          <input
            type="checkbox"
            checked={overwriteConfirmed}
            onChange={(e) => setOverwriteConfirmed(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5"
          />
          Overwrite {blankValidation?.existingCredential?.name ?? "the existing credential"}
        </label>
      ) : null}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => void handleWrite()}
          disabled={!canWrite}
          className={`flex-1 gap-1 ${blankValidation?.ready ? "bg-green-600 hover:bg-green-700" : ""}`}
        >
          {stage === "writing" || stage === "verifying" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          {stage === "writing"
            ? "Writing…"
            : stage === "verifying"
              ? "Verifying…"
              : "Write and verify"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSim}
          disabled={disabled || !simCommand}
          className="gap-1"
        >
          <Play className="h-3 w-3" />
          Simulate
        </Button>
      </div>

      {workflowMessage ? (
        <div
          className={`rounded-md border p-2 text-[11px] ${
            stage === "succeeded"
              ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300"
              : stage === "failed"
                ? "border-destructive/50 bg-destructive/10 text-destructive"
                : "border-border/60 bg-muted/40 text-muted-foreground"
          }`}
        >
          <div className="flex items-start gap-1.5">
            {stage === "succeeded" ? (
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : stage === "failed" ? (
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : workflowBusy ? (
              <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : null}
            <span>{workflowMessage}</span>
          </div>
          {verification ? (
            <ul className="mt-2 space-y-1 border-t border-current/15 pt-2">
              {verification.checks.map((item) => (
                <li key={item.id}>
                  {item.state === "ok" ? "✓" : "✕"} {item.label}: {item.detail}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default LFWriteSection;
