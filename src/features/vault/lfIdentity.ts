import type { LfCardRecord } from "./db";

/**
 * Stable identity for de-duping an LF card across re-reads. Lives apart from the
 * database operations so importers and parsers can match credentials without
 * pulling in Dexie.
 */
export function lfMatchKey(
  card: Pick<LfCardRecord, "tech" | "format" | "facilityCode" | "cardNumber" | "raw" | "fields">,
): string {
  if (card.facilityCode != null && card.cardNumber != null) {
    return `${card.tech}:${card.format ?? ""}:${card.facilityCode}:${card.cardNumber}:${JSON.stringify(card.fields ?? {})}`;
  }
  if (card.raw) return `${card.tech}:raw:${card.raw.toUpperCase()}`;
  if (card.fields && Object.keys(card.fields).length) {
    return `${card.tech}:fields:${JSON.stringify(card.fields)}`;
  }
  return "";
}
