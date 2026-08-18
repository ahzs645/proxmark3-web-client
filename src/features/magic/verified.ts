import type { OperationCheckRecord } from "@/features/vault/db";
import {
  executeVerifiedOperation,
  type VerifiedOperationResult,
  type VerifiedOperationRunner,
} from "@/features/operations/verified";
import { parseMagicInfo } from "./detect";
import type { MagicCardType } from "./types";
import { parseReadBlockData } from "@/features/memory/lib/batch";

function normalizeHex(value: string): string {
  return value.replace(/[^0-9A-F]/gi, "").toUpperCase();
}

export function parseUidFromHfOutput(output: string): string | null {
  const match = output.match(/UID[.:\s]+((?:[0-9A-F]{2}[\s:]*){4,10})/i);
  const uid = normalizeHex(match?.[1] ?? "");
  return [8, 14, 20].includes(uid.length) ? uid : null;
}

function magicPreflight(expected: MagicCardType, output: string): OperationCheckRecord[] {
  const detected = parseMagicInfo(output);
  const compatible = Boolean(
    detected?.isMagic &&
    (expected === "unknown" || detected.gen === expected || detected.gen === "unknown"),
  );
  return [
    {
      id: "magic-generation",
      label: "Magic-card generation",
      state: compatible ? "ok" : "error",
      detail: compatible
        ? `${detected?.label || detected?.gen} supports the selected write method.`
        : detected?.isMagic
          ? `Detected ${detected.label || detected.gen}, but ${expected} was selected.`
          : "No supported magic-card capability was detected.",
      blocking: true,
    },
  ];
}

function uidReadback(expectedUid: string, output: string): OperationCheckRecord[] {
  const actual = parseUidFromHfOutput(output);
  const expected = normalizeHex(expectedUid);
  return [
    {
      id: "uid-readback",
      label: "UID read-back",
      state: actual === expected ? "ok" : "error",
      detail:
        actual === expected
          ? `${actual} matched the requested UID.`
          : `Expected ${expected}; read back ${actual ?? "no UID"}.`,
      blocking: true,
    },
  ];
}

export function runVerifiedMagicUidWrite(
  runner: VerifiedOperationRunner,
  input: { cardType: MagicCardType; uid: string; writeCommand: string },
  onStage?: (stage: "preflight" | "writing" | "verifying") => void,
): Promise<VerifiedOperationResult> {
  return executeVerifiedOperation(
    runner,
    {
      origin: "magic-uid-write",
      preflight: {
        command: "hf mf info",
        check: (output) => magicPreflight(input.cardType, output),
      },
      writeCommand: input.writeCommand,
      readback: {
        command: "hf 14a info",
        check: (output) => uidReadback(input.uid, output),
      },
    },
    onStage,
  );
}

function block0Readback(expectedData: string, output: string): OperationCheckRecord[] {
  const expected = normalizeHex(expectedData);
  const actual = parseReadBlockData(output, 0);
  return [
    {
      id: "block0-readback",
      label: "Manufacturer block read-back",
      state: actual === expected ? "ok" : "error",
      detail:
        actual === expected
          ? "All 16 manufacturer-block bytes matched the requested value."
          : `Expected ${expected}; read back ${actual ?? "no block data"}.`,
      blocking: true,
    },
  ];
}

export function runVerifiedMagicBlock0Write(
  runner: VerifiedOperationRunner,
  input: {
    cardType: MagicCardType;
    expectedData: string;
    writeCommand: string;
    readbackCommand: string;
  },
  onStage?: (stage: "preflight" | "writing" | "verifying") => void,
): Promise<VerifiedOperationResult> {
  return executeVerifiedOperation(
    runner,
    {
      origin: "magic-block0-write",
      preflight: {
        command: "hf mf info",
        check: (output) => magicPreflight(input.cardType, output),
      },
      writeCommand: input.writeCommand,
      readback: {
        command: input.readbackCommand,
        check: (output) => block0Readback(input.expectedData, output),
      },
    },
    onStage,
  );
}
