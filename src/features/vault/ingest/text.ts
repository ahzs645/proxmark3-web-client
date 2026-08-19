import { parseLfCredential, parseT55xxDetect } from "@/features/lf-tools/lfParse";
import type { ParsedLfCredential } from "@/features/lf-tools/formats";
import type { ParsedT55xxDetect } from "@/features/lf-tools/lfParse";

/**
 * Capture folders mix two dialects: raw pm3 console logs, which the live
 * terminal parsers already understand, and hand-written summary notes that use
 * a dotted-label layout:
 *
 *   Format......... HID H10301 26-bit
 *   Facility Code.. 200
 *   Card Number.... 46285
 *
 * Rather than teach every format parser a second syntax, the summary dialect is
 * normalized back into something the pm3 registry recognizes. All LF format
 * knowledge stays in one place; only the note-taking quirks live here.
 */

/** Dotted labels → `Label: value`, plus the aliases pm3 prints as shorthand. */
export function normalizeSummaryLabels(text: string): string {
  return text
    .replace(/^([^\n.:]+?)\.{2,}\s*/gm, "$1: ")
    .replace(/\bFacility Code\s*:/gi, "FC:")
    .replace(/\bCard Number\s*:/gi, "CN:")
    .replace(/\bEM410x ID\s*:/gi, "EM410x ID ")
    .replace(/\bBlock0\s*\(config\)\s*/gi, "Block0 ")
    .replace(/\bChip type\s*:/gi, "Chip type ")
    .replace(/\bPassword set\s*:/gi, "Password set ")
    .replace(/\bRaw\s*:/gi, "raw: ");
}

/**
 * Read an LF credential out of a capture file, whether it is raw pm3 output or
 * a summary note. The raw text is tried first so genuine console logs are never
 * altered by normalization.
 */
export function parseLfFromCapture(text: string): ParsedLfCredential | null {
  return parseLfCredential(text) ?? parseLfCredential(normalizeSummaryLabels(text));
}

/** Same two-pass treatment for the T55xx carrier check. */
export function parseT55xxFromCapture(text: string): ParsedT55xxDetect | null {
  return parseT55xxDetect(text) ?? parseT55xxDetect(normalizeSummaryLabels(text));
}

/** Card UID mentioned in a capture note, e.g. "(dual-frequency card, HF UID 84F0B240)". */
export function findReferencedUid(text: string): string {
  const match = text.match(/\bUID\b[^0-9A-Fa-f]{0,4}((?:[0-9A-Fa-f]{2}[\s-]?){4,10})/);
  if (!match) return "";
  const hex = match[1].replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
  return hex.length >= 8 && hex.length % 2 === 0 ? hex : "";
}
