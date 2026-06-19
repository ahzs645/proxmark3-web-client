import type { PM3DumpJson } from "@/features/memory/types";
import type { TagInfo } from "./types";

function groupHex(hex: string | undefined, separator: string): string | undefined {
  if (!hex) return undefined;
  const clean = hex.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (!clean) return undefined;
  return clean.match(/.{1,2}/g)?.join(separator) ?? clean;
}

/**
 * Derive card identity (UID / type / SAK / ATQA) from a parsed Proxmark3 dump
 * so the Tag Information panel reflects a card after an attack or dump, even
 * when no `hf search` / `hf 14a info` output was ever parsed (e.g. running
 * `hf mf autopwn` straight away). Prefers the dump's `Card` metadata and falls
 * back to the MIFARE Classic block 0 layout (UID|BCC|SAK|ATQA|...).
 */
export function tagInfoFromDump(dump: PM3DumpJson): Partial<TagInfo> | null {
  const block0 = dump.blocks?.["0"]?.replace(/[^0-9a-fA-F]/g, "") ?? "";

  const uidRaw = dump.Card?.UID || (block0.length >= 8 ? block0.slice(0, 8) : "");
  const uid = groupHex(uidRaw, ":");
  if (!uid) return null;

  const sak =
    dump.Card?.SAK?.replace(/[^0-9a-fA-F]/g, "").toUpperCase() ||
    (block0.length >= 12 ? block0.slice(10, 12).toUpperCase() : undefined);
  const atqa = groupHex(dump.Card?.ATQA, " ");

  const blockCount = dump.blocks ? Object.keys(dump.blocks).length : 0;
  let type = "MIFARE Classic";
  if (sak === "18" || sak === "19") type = "MIFARE Classic 4K";
  else if (sak === "08" || sak === "09") type = "MIFARE Classic 1K";
  else if (blockCount > 128) type = "MIFARE Classic 4K";
  else if (blockCount > 0) type = "MIFARE Classic 1K";

  return { uid, type, sak: sak || undefined, atqa, protocol: "HF", subtype: "MIFARE" };
}
