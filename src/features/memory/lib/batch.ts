import type { Block, SectorKeysRecord } from "@/features/memory/types";

export interface MifareAuthCandidate {
  keyType: "a" | "b";
  key: string;
}

function cleanKey(value?: string): string | undefined {
  const clean = value?.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  return clean?.length === 12 && !clean.includes("?") ? clean : undefined;
}

export function authCandidates(
  block: Block,
  keys: SectorKeysRecord,
  fallbackType: "A" | "B",
  fallbackKey: string,
): MifareAuthCandidate[] {
  const sector = keys[String(block.sector)];
  const candidates: MifareAuthCandidate[] = [];
  const append = (keyType: "a" | "b", value?: string) => {
    const key = cleanKey(value);
    if (key && !candidates.some((item) => item.keyType === keyType && item.key === key))
      candidates.push({ keyType, key });
  };
  append("a", sector?.KeyA);
  append("b", sector?.KeyB);
  append(fallbackType.toLowerCase() as "a" | "b", fallbackKey);
  append("a", "FFFFFFFFFFFF");
  append("b", "FFFFFFFFFFFF");
  return candidates;
}

export function buildReadBlockCommand(block: number, auth: MifareAuthCandidate): string {
  if (!Number.isInteger(block) || block < 0 || block > 255)
    throw new Error("Unsafe MIFARE block number.");
  return `hf mf rdbl --blk ${block} -${auth.keyType} -k ${auth.key}`;
}

export function buildWriteBlockCommand(
  block: number,
  data: string,
  auth: MifareAuthCandidate,
): string {
  const clean = data.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (!Number.isInteger(block) || block < 0 || block > 255 || clean.length !== 32)
    throw new Error("Unsafe MIFARE block write.");
  return `hf mf wrbl --blk ${block} -${auth.keyType} -k ${auth.key} -d ${clean} --force`;
}

export function parseReadBlockData(output: string, expectedBlock: number): string | undefined {
  const escape = String.fromCharCode(27);
  const ansi = new RegExp(`${escape}\\[[0-?]*[ -/]*[@-~]`, "g");
  const lines = output.replace(ansi, "").split(/\r?\n/).reverse();
  for (const line of lines) {
    if (/command|pm3\s*-->/i.test(line)) continue;
    const table = line.match(
      /^\s*(?:\[?\s*)?(\d+)(?:\s*\]?)?\s*[|:]\s*((?:[0-9a-fA-F]{2}[\s|:]*){16})/,
    );
    if (table && Number(table[1]) === expectedBlock)
      return table[2].replace(/[^a-fA-F0-9]/g, "").toUpperCase();
    const labeled = line.match(/(?:data|block\s+data)\s*[:=]\s*((?:[0-9a-fA-F]{2}[\s:]*){16})/i);
    if (labeled) return labeled[1].replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  }
  return undefined;
}
