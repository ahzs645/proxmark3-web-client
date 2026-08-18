import type { OperationCheckRecord } from "@/features/vault/db";
import type { ParsedLfCredential, ParsedT55xxDetect } from "../lfParse";
import { parseLfCredential, parseT55xxDetect } from "../lfParse";
import { credentialField, LF_FORMATS_BY_TECH } from "../formats";

export interface LfBlankValidation {
  carrier: ParsedT55xxDetect | null;
  existingCredential: ParsedLfCredential | null;
  checks: OperationCheckRecord[];
  ready: boolean;
}

export interface LfCredentialVerification {
  actual: ParsedLfCredential | null;
  checks: OperationCheckRecord[];
  passed: boolean;
  summary: string;
}

function check(
  id: string,
  label: string,
  matches: boolean,
  expected: string,
  actual: string,
): OperationCheckRecord {
  return {
    id,
    label,
    state: matches ? "ok" : "error",
    detail: matches ? actual : `Expected ${expected}; read back ${actual}.`,
    blocking: true,
  };
}

function normalizedRaw(value: string | undefined): string {
  return (value ?? "").replace(/[^0-9A-F]/gi, "").toUpperCase();
}

export function validateLfBlank(detectOutput: string, searchOutput: string): LfBlankValidation {
  const carrier = parseT55xxDetect(detectOutput);
  const existingCredential = parseLfCredential(searchOutput);
  const checks: OperationCheckRecord[] = [
    {
      id: "carrier",
      label: "Writable carrier",
      state: carrier?.writable ? "ok" : "error",
      detail:
        carrier?.error ??
        (carrier?.writable
          ? `${carrier.chip ?? "T55xx"} detected${carrier.config ? ` (Block 0 ${carrier.config})` : ""}.`
          : "No supported writable T55xx carrier was detected."),
      blocking: true,
    },
    {
      id: "password",
      label: "Password protection",
      state: carrier?.passwordSet ? "error" : carrier ? "ok" : "skipped",
      detail: carrier?.passwordSet
        ? "The carrier is password-protected. Unlock or wipe it with a known password before writing."
        : carrier
          ? "No password protection was reported."
          : "Password state could not be checked.",
      blocking: true,
    },
  ];

  if (existingCredential) {
    checks.push({
      id: "existing-data",
      label: "Existing credential",
      state: "warning",
      detail: `${existingCredential.name} is already stored on this carrier and will be overwritten.`,
      blocking: false,
    });
  } else {
    checks.push({
      id: "existing-data",
      label: "Existing credential",
      state: "ok",
      detail: "No supported LF credential was decoded from the carrier.",
      blocking: false,
    });
  }

  return {
    carrier,
    existingCredential,
    checks,
    ready: checks.every((item) => !item.blocking || item.state !== "error"),
  };
}

/** Compare a post-write `lf search` result with the exact requested credential. */
export function verifyLfCredential(
  expected: ParsedLfCredential,
  readbackOutput: string,
): LfCredentialVerification {
  const actual = parseLfCredential(readbackOutput);
  if (!actual) {
    return {
      actual: null,
      passed: false,
      summary: "Verification failed: no supported LF credential was read back.",
      checks: [
        {
          id: "readback",
          label: "Read-back credential",
          state: "error",
          detail:
            "No supported LF credential was decoded. Keep the card in place and retry verification.",
          blocking: true,
        },
      ],
    };
  }

  const checks: OperationCheckRecord[] = [
    check("technology", "Technology", actual.tech === expected.tech, expected.tech, actual.tech),
  ];

  const capability = LF_FORMATS_BY_TECH.get(expected.tech);
  for (const field of capability?.verificationFields ?? ["raw"]) {
    if (field === "tech") continue;
    const expectedValue = credentialField(expected, field);
    if (expectedValue == null || expectedValue === "") continue;
    const actualValue = credentialField(actual, field);
    const fieldDefinition = capability?.editableFields.find((item) => item.id === field);
    const label = fieldDefinition?.label ?? (field === "raw" ? "Credential data" : field);
    const expectedText =
      field === "raw" ? normalizedRaw(String(expectedValue)) : String(expectedValue).toUpperCase();
    const actualText =
      field === "raw"
        ? normalizedRaw(actualValue == null ? undefined : String(actualValue))
        : String(actualValue ?? "missing").toUpperCase();
    checks.push(
      check(
        field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
        label,
        Boolean(expectedText) && actualText === expectedText,
        expectedText,
        actualText || "missing",
      ),
    );
  }

  const failed = checks.filter((item) => item.blocking && item.state === "error");
  return {
    actual,
    checks,
    passed: failed.length === 0,
    summary:
      failed.length === 0
        ? `${actual.name} verified after writing.`
        : `Verification failed: ${failed.map((item) => item.label).join(", ")} did not match.`,
  };
}
