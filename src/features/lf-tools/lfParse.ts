import type { LfCardRecord } from "@/features/vault/db";
import type { TagInfo } from "@/features/tag-info/types";
import { parseRegisteredLfCredential, type ParsedLfCredential } from "./formats";

export type { ParsedLfCredential } from "./formats";

/** A decoded LF credential extracted from `lf search` / `lf hid reader` output. */
/** Result of parsing `lf t55xx detect` output. */
export interface ParsedT55xxDetect {
  chip?: string;
  config?: string;
  passwordSet?: boolean;
  writable: boolean;
  error?: string;
}

const stripAnsi = (text: string): string =>
  // eslint-disable-next-line no-control-regex
  text.replace(/\x1b\[[0-9;]*m/g, "");

/**
 * Parse the decoded credential out of an LF read burst. Returns the strongest
 * match found in the chunk, or null if it holds no recognizable LF credential.
 *
 * The PM3 client prints these together, e.g.
 *   [+] [H10301  ] HID H10301 26-bit   FC: 200  CN: 46285  parity ( ok )
 *   [=] raw: 00000000000000200591699b
 *   [+] Valid HID Prox ID found!
 */
export function parseLfCredential(text: string): ParsedLfCredential | null {
  const clean = stripAnsi(text);
  return parseRegisteredLfCredential(clean);
}

/**
 * Parse `lf t55xx detect`. A successful detect is our LF "magic"/writable check:
 * a T55x7 / T5555 carrier is the rewritable chip that clones are written to.
 */
export function parseT55xxDetect(text: string): ParsedT55xxDetect | null {
  const clean = stripAnsi(text);
  if (!/Chip type/i.test(clean)) {
    if (/OLD frame with payload too short/i.test(clean)) {
      return {
        writable: false,
        error:
          "A truncated serial frame blocked the LF capture. Reconnect the reader and retry; if it persists, check the WebSerial transport buffer.",
      };
    }
    if (/Could not detect modulation automatically/i.test(clean)) {
      return {
        writable: false,
        error:
          "Could not detect the card modulation. Reposition the card over the LF antenna and retry.",
      };
    }
    return null;
  }

  // `lf t55xx config` prints the same field labels as a successful detect and
  // can retain an earlier non-zero Block0 even after the card is removed. Do
  // not turn configuration-only output into a phantom active card.
  if (/current t55xx config/i.test(clean)) {
    return null;
  }

  // Output is also parsed one line at a time. A standalone `Chip type` line
  // is not enough to prove that detect completed; require its Block0 result.
  if (!/Block0/i.test(clean)) {
    return null;
  }

  const chipMatch = clean.match(/Chip type[.\s]*([A-Za-z0-9]+)/);
  const configMatch = clean.match(/Block0[.\s]*([0-9A-Fa-f]{8})/);
  const passwordMatch = clean.match(/Password set[.\s]*(Yes|No)/i);
  const chip = chipMatch?.[1];
  const writable = Boolean(chip && /^T5(5|)/i.test(chip));

  return {
    chip,
    config: configMatch?.[1]?.toUpperCase(),
    passwordSet: passwordMatch ? /yes/i.test(passwordMatch[1]) : undefined,
    writable,
  };
}

/** A saved LF card reloaded as the editable fields the write form needs. */
export function lfCardToForm(card: LfCardRecord): ParsedLfCredential {
  return {
    tech: card.tech,
    format: card.format,
    facilityCode: card.facilityCode,
    cardNumber: card.cardNumber,
    raw: card.raw,
    fields: card.fields,
    name: card.name,
  };
}

/** Present a decoded LF credential through the workbench's shared card target. */
export function lfCredentialToTagInfo(card: ParsedLfCredential): TagInfo {
  const fallbackId =
    card.tech === "hid" && card.facilityCode != null && card.cardNumber != null
      ? `${card.format ?? "HID"}-${card.facilityCode}-${card.cardNumber}`
      : undefined;

  return {
    uid: card.raw ?? fallbackId,
    type:
      card.tech === "hid"
        ? `HID ${card.format ?? "Prox"}`
        : card.tech === "em410x"
          ? "EM410x"
          : card.name,
    protocol: "LF",
    subtype: card.tech.toUpperCase(),
  };
}
