import type { CardType, PM3DumpJson } from "@/features/memory/types";

export interface ImportedDump {
  dump: PM3DumpJson;
  name: string;
  cardType: CardType;
  sourceFormat: "json" | "binary" | "eml" | "mfu";
}

const CLASSIC_BLOCK_BYTES = 16;
const MFU_HEADER_BYTES = 56;

function cleanHex(value: string): string {
  return value.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function inferredClassicUid(block0: string): string | undefined {
  const clean = cleanHex(block0);
  if (clean.length < 10) return undefined;
  const uid = clean.slice(0, 8);
  const bytes = uid.match(/../g)?.map((value) => Number.parseInt(value, 16)) ?? [];
  const bcc = bytes.reduce((value, byte) => value ^ byte, 0);
  return bcc === Number.parseInt(clean.slice(8, 10), 16) ? uid : undefined;
}

function classicDumpFromBytes(bytes: Uint8Array, fileName: string): ImportedDump {
  if (bytes.length !== 1024 && bytes.length !== 4096) {
    throw new Error(
      `Unsupported Classic dump size: ${bytes.length} bytes (expected 1024 or 4096).`,
    );
  }
  const blocks: Record<string, string> = {};
  for (let offset = 0; offset < bytes.length; offset += CLASSIC_BLOCK_BYTES) {
    blocks[String(offset / CLASSIC_BLOCK_BYTES)] = bytesToHex(
      bytes.slice(offset, offset + CLASSIC_BLOCK_BYTES),
    );
  }
  const cardType: CardType = bytes.length === 4096 ? "classic-4k" : "classic-1k";
  return {
    name: fileName,
    cardType,
    sourceFormat: "binary",
    dump: {
      Created: new Date().toISOString(),
      FileType: "raw classic binary",
      Card: { UID: inferredClassicUid(blocks["0"] ?? "") },
      blocks,
    },
  };
}

function mfuDumpFromBytes(bytes: Uint8Array, fileName: string): ImportedDump {
  if (bytes.length < MFU_HEADER_BYTES + 16) throw new Error("MFU dump is too short.");
  const maxPage = bytes[11];
  const expected = MFU_HEADER_BYTES + (maxPage + 1) * 4;
  if (bytes.length !== expected) {
    throw new Error(
      `MFU dump length ${bytes.length} does not match max page ${maxPage} (${expected}).`,
    );
  }
  const pageBytes = bytes.slice(MFU_HEADER_BYTES);
  const blocks: Record<string, string> = {};
  for (let offset = 0; offset < pageBytes.length; offset += 4) {
    blocks[String(offset / 4)] = bytesToHex(pageBytes.slice(offset, offset + 4));
  }
  const uid = bytesToHex(new Uint8Array([...pageBytes.slice(0, 3), ...pageBytes.slice(4, 8)]));
  return {
    name: fileName,
    cardType: "ultralight",
    sourceFormat: "mfu",
    dump: {
      Created: new Date().toISOString(),
      FileType: "pm3 mfu binary",
      Card: { UID: uid },
      blocks,
      MfuHeader: bytesToHex(bytes.slice(0, MFU_HEADER_BYTES)),
    },
  };
}

function emlDump(text: string, fileName: string): ImportedDump {
  const rows: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s*(?:#|\/\/).*$/, "").trim();
    if (!line) continue;
    const afterLabel = line.includes(":") ? line.slice(line.lastIndexOf(":") + 1) : line;
    const hex = cleanHex(afterLabel);
    if (hex.length === 32) rows.push(hex);
  }
  if (rows.length !== 64 && rows.length !== 256) {
    throw new Error(`Unsupported EML block count: ${rows.length} (expected 64 or 256).`);
  }
  const blocks = Object.fromEntries(rows.map((row, index) => [String(index), row]));
  return {
    name: fileName,
    cardType: rows.length === 256 ? "classic-4k" : "classic-1k",
    sourceFormat: "eml",
    dump: {
      Created: new Date().toISOString(),
      FileType: "proxmark eml text",
      Card: { UID: inferredClassicUid(rows[0]) },
      blocks,
    },
  };
}

function jsonDump(text: string, fileName: string): ImportedDump {
  const dump = JSON.parse(text) as PM3DumpJson;
  if (!dump || typeof dump !== "object" || (!dump.blocks && !dump.Card)) {
    throw new Error("JSON is not a Proxmark dump.");
  }
  const values = Object.values(dump.blocks ?? {});
  const pageSized = values.length > 0 && values.every((value) => cleanHex(value).length === 8);
  const count = values.length;
  return {
    dump,
    name: fileName,
    sourceFormat: "json",
    cardType: pageSized ? "ultralight" : count > 64 ? "classic-4k" : "classic-1k",
  };
}

export async function importDumpFile(file: File): Promise<ImportedDump> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".json")) return jsonDump(await file.text(), file.name);
  if (lower.endsWith(".eml") || lower.endsWith(".txt"))
    return emlDump(await file.text(), file.name);

  if (!lower.endsWith(".bin") && !lower.endsWith(".dump")) {
    throw new Error(`Unsupported dump extension for ${file.name}.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const looksLikeMfu =
    bytes.length >= MFU_HEADER_BYTES + 16 &&
    bytes.length === MFU_HEADER_BYTES + (bytes[11] + 1) * 4;
  return looksLikeMfu ? mfuDumpFromBytes(bytes, file.name) : classicDumpFromBytes(bytes, file.name);
}

export const dumpImportInternals = {
  classicDumpFromBytes,
  emlDump,
  mfuDumpFromBytes,
};
