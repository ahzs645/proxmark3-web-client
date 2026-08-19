import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useCommands } from "@/features/commands/context";
import { useTarget } from "@/features/target/context";
import { MagicHeader } from "@/features/magic/components/MagicHeader";
import { MagicCardTypeSection } from "@/features/magic/components/MagicCardTypeSection";
import { MagicUidSection } from "@/features/magic/components/MagicUidSection";
import { MagicBlock0Section } from "@/features/magic/components/MagicBlock0Section";
import { MagicQuickOperationsSection } from "@/features/magic/components/MagicQuickOperationsSection";
import { MagicWarningSection } from "@/features/magic/components/MagicWarningSection";
import { buildBlock0Preview } from "@/features/magic/block0";
import {
  buildDetectCommand,
  buildLoadDumpCommand,
  buildSetUidCommand,
  buildUnlockCommands,
  buildViewCardCommand,
  buildWipeCommand,
  buildWriteBlock0Command,
} from "@/features/magic/commands";
import { CARD_TYPES } from "@/features/magic/constants";
import { calculateBcc, generateRandomUid, validateUid } from "@/features/magic/uid";
import { runVerifiedMagicBlock0Write, runVerifiedMagicUidWrite } from "@/features/magic/verified";
import type { KeyType, MagicCardPanelProps, MagicCardType } from "@/features/magic/types";
import { makeOperationId } from "@/features/operations/report";
import { putOperation } from "@/features/vault/operations";
import { cn } from "@/lib/utils";
import { buildReadBlockCommand } from "@/features/memory/lib/batch";
import { MagicRestorePipeline } from "@/features/memory/components/MagicRestorePipeline";

export function MagicCardPanel({ onCommand, disabled = false }: MagicCardPanelProps) {
  // Pull the card to clone from the shared target rather than props, so a scan
  // performed after this panel mounts still flows in.
  const { target } = useTarget();
  const commands = useCommands();
  const detectedUid = target.identity?.uid?.replace(/:/g, "") ?? "";
  const detectedAtqa = target.identity?.atqa?.replace(/\s/g, "") ?? "";
  const detectedSak = target.identity?.sak ?? "";

  const [cardType, setCardType] = useState<MagicCardType>("gen1a");
  const [uid, setUid] = useState(detectedUid);
  const [atqa, setAtqa] = useState(detectedAtqa || "0004");
  const [sak, setSak] = useState(detectedSak || "08");

  // Adopt the detected card's identity whenever a *new* card becomes the target,
  // without overwriting fields the user is editing for the same card.
  const syncedUidRef = useRef<string | null>(null);
  useEffect(() => {
    if (!detectedUid || syncedUidRef.current === detectedUid) return;
    syncedUidRef.current = detectedUid;
    setUid(detectedUid);
    if (detectedAtqa) setAtqa(detectedAtqa);
    if (detectedSak) setSak(detectedSak);
  }, [detectedUid, detectedAtqa, detectedSak]);
  // Adopt the magic generation detected by `hf mf info` (the Detect button)
  // whenever a fresh detect lands, so the user does not have to hand-pick it.
  const detectedMagic = target.magic;
  const syncedMagicRef = useRef<string | null>(null);
  useEffect(() => {
    if (!detectedMagic?.isMagic) return;
    const key = `${detectedMagic.gen}:${detectedMagic.at}`;
    if (syncedMagicRef.current === key) return;
    syncedMagicRef.current = key;
    setCardType(detectedMagic.gen);
  }, [detectedMagic]);

  const [gen4Password, setGen4Password] = useState("00000000");
  const [authKey, setAuthKey] = useState("FFFFFFFFFFFF");
  const [authKeyType, setAuthKeyType] = useState<KeyType>("A");
  const [showBlock0Builder, setShowBlock0Builder] = useState(false);
  const [uidWriteBusy, setUidWriteBusy] = useState(false);
  const [uidWriteStatus, setUidWriteStatus] = useState<string | null>(null);
  const [uidWritePassed, setUidWritePassed] = useState<boolean | null>(null);
  const [blockWriteBusy, setBlockWriteBusy] = useState(false);
  const [blockWriteStatus, setBlockWriteStatus] = useState<string | null>(null);
  const [blockWritePassed, setBlockWritePassed] = useState<boolean | null>(null);

  const [block0Uid, setBlock0Uid] = useState("");
  const [block0Bcc, setBlock0Bcc] = useState("");
  const [block0Sak, setBlock0Sak] = useState("08");
  const [block0Atqa, setBlock0Atqa] = useState("0004");
  const [block0Manufacturer, setBlock0Manufacturer] = useState("00000000000000");

  const uidValidation = useMemo(() => validateUid(uid), [uid]);
  const calculatedBcc = useMemo(() => calculateBcc(block0Uid), [block0Uid]);
  const block0Preview = useMemo(
    () =>
      buildBlock0Preview({
        uid: block0Uid,
        bcc: block0Bcc,
        calculatedBcc,
        sak: block0Sak,
        atqa: block0Atqa,
        manufacturer: block0Manufacturer,
      }),
    [block0Uid, block0Bcc, calculatedBcc, block0Sak, block0Atqa, block0Manufacturer],
  );

  const handleUidChange = useCallback((value: string) => {
    setUid(
      value
        .toUpperCase()
        .replace(/[^A-F0-9]/gi, "")
        .slice(0, 20),
    );
  }, []);

  const handleRandomUid = useCallback(() => {
    const length = uid.length === 14 ? 7 : uid.length === 20 ? 10 : 4;
    setUid(generateRandomUid(length));
  }, [uid.length]);

  const copyToClipboard = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
  }, []);

  const handleSetUid = useCallback(async () => {
    const command = buildSetUidCommand({
      cardType,
      uid,
      atqa,
      sak,
      gen4Password,
    });

    if (!command) return;
    const startedAt = Date.now();
    const operationId = makeOperationId("magic-uid");
    setUidWriteBusy(true);
    setUidWritePassed(null);
    setUidWriteStatus("Checking the magic-card generation…");
    try {
      const result = await runVerifiedMagicUidWrite(
        commands,
        { cardType, uid, writeCommand: command },
        (stage) =>
          setUidWriteStatus(
            stage === "preflight"
              ? "Checking the magic-card generation…"
              : stage === "writing"
                ? "Writing UID. Keep the card still…"
                : "Reading the UID back for exact comparison…",
          ),
      );
      const endedAt = Date.now();
      setUidWritePassed(result.passed);
      setUidWriteStatus(result.summary);
      void putOperation({
        id: operationId,
        kind: "write",
        command,
        origin: "magic-uid-write",
        status: result.passed ? "succeeded" : "failed",
        queuedAt: startedAt,
        startedAt: result.jobs[0]?.startedAt ?? startedAt,
        endedAt,
        durationMs: endedAt - startedAt,
        targetUid: uid,
        targetType: CARD_TYPES[cardType].label,
        phase: "verifying",
        progress: 100,
        summary: result.summary,
        outputTail: result.jobs.flatMap((job) => job.outputTail).slice(-100),
        updatedAt: endedAt,
        workflow: "magic-uid-write",
        method: cardType,
        checks: result.checks,
        verified: result.passed,
      });
    } catch (error) {
      setUidWritePassed(false);
      setUidWriteStatus(error instanceof Error ? error.message : "Verified UID write failed.");
    } finally {
      setUidWriteBusy(false);
    }
  }, [atqa, cardType, commands, gen4Password, sak, uid]);

  const handleWriteBlock0 = useCallback(async () => {
    const command = buildWriteBlock0Command({
      cardType,
      block0Preview,
      authKeyType,
      authKey,
      gen4Password,
    });

    if (!command || block0Preview.length !== 32) return;
    const startedAt = Date.now();
    const operationId = makeOperationId("magic-block0");
    setBlockWriteBusy(true);
    setBlockWritePassed(null);
    setBlockWriteStatus("Checking the magic-card generation…");
    try {
      const result = await runVerifiedMagicBlock0Write(
        commands,
        {
          cardType,
          expectedData: block0Preview,
          writeCommand: command,
          readbackCommand: buildReadBlockCommand(0, {
            keyType: authKeyType.toLowerCase() as "a" | "b",
            key: authKey.replace(/[^A-F0-9]/gi, "").toUpperCase(),
          }),
        },
        (stage) =>
          setBlockWriteStatus(
            stage === "preflight"
              ? "Checking the magic-card generation…"
              : stage === "writing"
                ? "Writing block 0. Keep the card still…"
                : "Reading all 16 bytes back for exact comparison…",
          ),
      );
      const endedAt = Date.now();
      setBlockWritePassed(result.passed);
      setBlockWriteStatus(result.summary);
      void putOperation({
        id: operationId,
        kind: "write",
        command,
        origin: "magic-block0-write",
        status: result.passed ? "succeeded" : "failed",
        queuedAt: startedAt,
        startedAt: result.jobs[0]?.startedAt ?? startedAt,
        endedAt,
        durationMs: endedAt - startedAt,
        targetUid: block0Uid || uid,
        targetType: CARD_TYPES[cardType].label,
        phase: "verifying",
        progress: 100,
        summary: result.summary,
        outputTail: result.jobs.flatMap((job) => job.outputTail).slice(-100),
        updatedAt: endedAt,
        workflow: "magic-block0-write",
        method: cardType,
        checks: result.checks,
        verified: result.passed,
      });
    } catch (error) {
      setBlockWritePassed(false);
      setBlockWriteStatus(
        error instanceof Error ? error.message : "Verified block-0 write failed.",
      );
    } finally {
      setBlockWriteBusy(false);
    }
  }, [authKey, authKeyType, block0Preview, block0Uid, cardType, commands, gen4Password, uid]);

  const handleUnlock = useCallback(() => {
    buildUnlockCommands(cardType, gen4Password).forEach((command) => onCommand(command));
  }, [cardType, gen4Password, onCommand]);

  const handleWipe = useCallback(() => {
    const command = buildWipeCommand(cardType, gen4Password);
    if (command) {
      onCommand(command);
    }
  }, [cardType, gen4Password, onCommand]);

  const handleDetect = useCallback(() => {
    onCommand(buildDetectCommand());
  }, [onCommand]);

  const handleViewCard = useCallback(() => {
    onCommand(buildViewCardCommand());
  }, [onCommand]);

  const handleLoadDump = useCallback(() => {
    onCommand(buildLoadDumpCommand());
  }, [onCommand]);

  const typeConfig = CARD_TYPES[cardType];

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <MagicHeader disabled={disabled} onDetect={handleDetect} />
      <CardContent className="flex-1 overflow-auto p-0">
        {detectedMagic && (
          <div className="px-3 pt-3">
            <div
              className={cn(
                "rounded-md border p-2 text-xs",
                detectedMagic.isMagic
                  ? "border-green-500/40 text-green-700 dark:text-green-400"
                  : "border-amber-500/40 text-amber-700 dark:text-amber-400",
              )}
            >
              {detectedMagic.isMagic
                ? `Magic detected: ${CARD_TYPES[detectedMagic.gen].label} — UID/block-0 write available.`
                : `No magic backdoor detected${
                    detectedMagic.label ? ` (${detectedMagic.label})` : ""
                  }. Writing a UID needs a magic card.`}
            </div>
          </div>
        )}
        {target.dump ? <MagicRestorePipeline activeDump={target.dump} disabled={disabled} /> : null}
        <MagicCardTypeSection
          cardType={cardType}
          onCardTypeChange={setCardType}
          typeConfig={typeConfig}
        />
        <MagicUidSection
          disabled={disabled || uidWriteBusy}
          cardType={cardType}
          uid={uid}
          uidValidation={uidValidation}
          onUidChange={handleUidChange}
          onRandomUid={handleRandomUid}
          onCopyUid={copyToClipboard}
          atqa={atqa}
          onAtqaChange={setAtqa}
          sak={sak}
          onSakChange={setSak}
          gen4Password={gen4Password}
          onGen4PasswordChange={setGen4Password}
          onWriteUid={() => void handleSetUid()}
        />
        {uidWriteStatus ? (
          <div
            className={`mx-3 mb-3 rounded-md border p-2 text-xs ${
              uidWritePassed === true
                ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300"
                : uidWritePassed === false
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border bg-muted/30 text-muted-foreground"
            }`}
          >
            {uidWriteStatus}
          </div>
        ) : null}
        <MagicBlock0Section
          disabled={disabled || blockWriteBusy}
          cardType={cardType}
          showBlock0Builder={showBlock0Builder}
          onToggleBlock0Builder={() => setShowBlock0Builder((prev) => !prev)}
          block0Uid={block0Uid}
          onBlock0UidChange={setBlock0Uid}
          block0Bcc={block0Bcc}
          onBlock0BccChange={setBlock0Bcc}
          calculatedBcc={calculatedBcc}
          block0Sak={block0Sak}
          onBlock0SakChange={setBlock0Sak}
          block0Atqa={block0Atqa}
          onBlock0AtqaChange={setBlock0Atqa}
          block0Manufacturer={block0Manufacturer}
          onBlock0ManufacturerChange={setBlock0Manufacturer}
          block0Preview={block0Preview}
          authKey={authKey}
          onAuthKeyChange={setAuthKey}
          authKeyType={authKeyType}
          onAuthKeyTypeChange={setAuthKeyType}
          gen4Password={gen4Password}
          onGen4PasswordChange={setGen4Password}
          onCopyBlock0Preview={copyToClipboard}
          onWriteBlock0={() => void handleWriteBlock0()}
        />
        {blockWriteStatus ? (
          <div
            className={`mx-3 mb-3 rounded-md border p-2 text-xs ${
              blockWritePassed === true
                ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300"
                : blockWritePassed === false
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border bg-muted/30 text-muted-foreground"
            }`}
          >
            {blockWriteStatus}
          </div>
        ) : null}
        <MagicQuickOperationsSection
          disabled={disabled}
          cardType={cardType}
          onUnlock={handleUnlock}
          onViewCard={handleViewCard}
          onWipe={handleWipe}
          onLoadDump={handleLoadDump}
        />
        <MagicWarningSection />
      </CardContent>
    </Card>
  );
}

export default MagicCardPanel;
