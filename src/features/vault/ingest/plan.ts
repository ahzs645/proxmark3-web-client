import type { CachedAssetKind } from "@/features/key-cache/types";
import { importDumpFile } from "@/features/memory/lib/import";
import type { PM3DumpJson, SectorKeysRecord } from "@/features/memory/types";
import { lfMatchKey } from "../lfIdentity";
import { normalizeUid } from "../uid";
import {
  parseHexBlockListing,
  parseMifareKeyBin,
  parseMifareKeyTable,
  sectorKeysFromTrailers,
  withSectorKeys,
} from "./mifare";
import { findReferencedUid, parseLfFromCapture, parseT55xxFromCapture } from "./text";
import {
  emptyPlan,
  type DumpSourceFormat,
  type IngestFile,
  type IngestPlan,
  type IngestedKeySet,
} from "./types";

const TEXT_EXTENSIONS = /\.(txt|log|md|json|eml|dic|csv)$/i;

function extensionOf(name: string): string {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function assetKindFor(name: string): CachedAssetKind {
  if (/\.(dic|keys?)$/i.test(name) || /key/i.test(name)) return "keys";
  if (/\.(bin|json|eml|dump)$/i.test(name)) return "dump";
  if (/\.(lua|sh|py|js|cjs)$/i.test(name)) return "script";
  return "raw";
}

/** Blocks a dump carries, used to decide 1K vs 4K and to match key sets. */
function blockCountOf(dump: PM3DumpJson): number {
  return Object.keys(dump.blocks ?? {}).length;
}

function sectorsOf(keys: SectorKeysRecord): number {
  return Object.keys(keys).length;
}

/**
 * Turn a set of files into an {@link IngestPlan} without writing anything.
 *
 * The strategy is deliberately forgiving: a capture folder is whatever the
 * operator happened to save, so every file is offered to each parser that could
 * plausibly read it, and anything unrecognized is still kept as a cached file
 * rather than dropped. Nothing here throws — a bad file becomes a skip entry.
 */
export async function planIngest(files: IngestFile[]): Promise<IngestPlan> {
  const plan = emptyPlan();
  const keySets: IngestedKeySet[] = [];

  for (const file of files) {
    if (file.bytes.length === 0) {
      plan.skipped.push({ name: file.path, reason: "empty file" });
      continue;
    }

    const extension = extensionOf(file.name);
    const isText = TEXT_EXTENSIONS.test(file.name);
    const text = isText ? decodeText(file.bytes) : "";

    // 1. Structured dump formats the memory importer already understands.
    if (/^\.(json|eml|bin|dump)$/.test(extension)) {
      try {
        const imported = await importDumpFile(new File([file.bytes as BlobPart], file.name));
        plan.dumps.push({
          name: imported.name,
          dump: imported.dump,
          uid: normalizeUid(imported.dump.Card?.UID),
          cardType: imported.cardType,
          format: imported.sourceFormat,
          blockCount: blockCountOf(imported.dump),
          sources: [file.path],
        });
        continue;
      } catch {
        // Not a dump — a `-key.bin` lands here, as does any short binary.
      }

      if (extension === ".bin") {
        const keys = parseMifareKeyBin(file.bytes);
        if (keys) {
          keySets.push({ keys, sectors: sectorsOf(keys), source: file.path });
          continue;
        }
      }
    }

    // 2. Text companions: hex listings, key tables, LF captures and notes.
    if (isText) {
      const blocks = parseHexBlockListing(text);
      if (blocks) {
        const dump: PM3DumpJson = {
          Created: new Date().toISOString(),
          FileType: "pm3 hex listing",
          Card: { UID: blocks["0"]?.slice(0, 8) },
          blocks,
        };
        plan.dumps.push({
          name: file.name,
          dump,
          uid: normalizeUid(dump.Card?.UID),
          cardType: Object.keys(blocks).length > 64 ? "classic-4k" : "classic-1k",
          format: "listing",
          blockCount: Object.keys(blocks).length,
          sources: [file.path],
        });
        continue;
      }

      const keyTable = parseMifareKeyTable(text);
      if (keyTable) {
        keySets.push({ keys: keyTable, sectors: sectorsOf(keyTable), source: file.path });
        continue;
      }

      const credential = parseLfFromCapture(text);
      if (credential) {
        plan.lfCards.push({
          credential,
          carrier: parseT55xxFromCapture(text),
          pairedUid: normalizeUid(findReferencedUid(text)),
          sources: [file.path],
        });
        continue;
      }
    }

    // 3. Anything else is still worth keeping, as a cached file.
    plan.assets.push({
      name: file.name,
      relativePath: file.path,
      kind: assetKindFor(file.name),
      bytes: file.bytes,
    });
  }

  attachKeySets(plan, keySets);
  dedupeDumps(plan);
  dedupeLfCards(plan);
  return finalizePlan(plan, files);
}

/**
 * Match recovered key sets to the dump they belong to. Sector count is the
 * discriminator (16 keys open a 1K, 40 a 4K); when only one dump was imported
 * the keys go to it regardless, since a capture folder describes one card.
 */
function attachKeySets(plan: IngestPlan, keySets: IngestedKeySet[]): void {
  for (const keySet of keySets) {
    const target =
      plan.dumps.find(
        (entry) => Math.abs(sectorsForBlocks(entry.blockCount) - keySet.sectors) === 0,
      ) ?? (plan.dumps.length === 1 ? plan.dumps[0] : undefined);

    if (!target) {
      plan.looseKeys.push(keySet);
      continue;
    }

    target.dump = withSectorKeys(target.dump, keySet.keys);
    target.sources.push(keySet.source);
  }

  // A Classic dump already carries its keys in the sector trailers; recovering
  // them means a plain `.bin` import still populates the key library.
  for (const entry of plan.dumps) {
    if (entry.dump.SectorKeys && Object.keys(entry.dump.SectorKeys).length) continue;
    const fromTrailers = sectorKeysFromTrailers(entry.dump.blocks ?? {});
    if (fromTrailers) entry.dump = withSectorKeys(entry.dump, fromTrailers);
  }
}

/**
 * Rank of a dump's source when the same card was saved several ways. The
 * machine-written formats outrank the human-readable listing, which exists for
 * reading rather than for round-tripping.
 */
const FORMAT_RANK: Record<DumpSourceFormat, number> = {
  json: 4,
  binary: 4,
  mfu: 4,
  eml: 3,
  listing: 1,
};

/**
 * Pick which of two identical dumps to keep. Ordered by source format, then by
 * how many keys the copy carries — never by the order files happened to arrive,
 * which for a dropped folder is filesystem order and differs between machines.
 */
function preferredDump(
  a: IngestPlan["dumps"][number],
  b: IngestPlan["dumps"][number],
): IngestPlan["dumps"][number] {
  const rank = FORMAT_RANK[b.format] - FORMAT_RANK[a.format];
  if (rank !== 0) return rank > 0 ? b : a;

  const keys =
    Object.keys(b.dump.SectorKeys ?? {}).length - Object.keys(a.dump.SectorKeys ?? {}).length;
  if (keys !== 0) return keys > 0 ? b : a;

  return a;
}

/** Content signature of a dump, used to spot the same card saved twice. */
function dumpSignature(entry: IngestPlan["dumps"][number]): string {
  const blocks = entry.dump.blocks ?? {};
  return Object.keys(blocks)
    .sort((a, b) => Number(a) - Number(b))
    .map((block) => blocks[block])
    .join("");
}

/**
 * A capture folder usually holds one card saved several ways — `.bin` next to
 * the `.hex.txt` listing pm3 writes beside it. Identical block content means one
 * dump, not two; the richest copy wins and the rest are reported as duplicates
 * so the summary explains why fewer rows appeared than files were dropped.
 */
function dedupeDumps(plan: IngestPlan): void {
  const bySignature = new Map<string, IngestPlan["dumps"][number]>();
  const kept: IngestPlan["dumps"] = [];

  for (const entry of plan.dumps) {
    const signature = `${entry.uid}:${dumpSignature(entry)}`;
    const existing = bySignature.get(signature);

    if (!existing) {
      bySignature.set(signature, entry);
      kept.push(entry);
      continue;
    }

    const winner = preferredDump(existing, entry);
    const loser = winner === entry ? existing : entry;

    winner.sources = [...new Set([...winner.sources, ...loser.sources])];
    if (winner !== existing) {
      kept[kept.indexOf(existing)] = winner;
      bySignature.set(signature, winner);
    }
    plan.skipped.push({ name: loser.sources[0], reason: `duplicate of ${winner.sources[0]}` });
  }

  plan.dumps = kept;
}

/**
 * The same LF credential is typically captured in several files — a search log,
 * a t55xx detect log, a summary note. They collapse into one card, keeping the
 * carrier details and HF pairing from whichever file actually recorded them.
 */
function dedupeLfCards(plan: IngestPlan): void {
  const byIdentity = new Map<string, IngestPlan["lfCards"][number]>();

  for (const entry of plan.lfCards) {
    const identity = lfMatchKey(entry.credential);
    const existing = identity ? byIdentity.get(identity) : undefined;

    if (!existing) {
      if (identity) byIdentity.set(identity, entry);
      continue;
    }

    existing.carrier = existing.carrier?.chip
      ? existing.carrier
      : (entry.carrier ?? existing.carrier);
    existing.pairedUid = existing.pairedUid || entry.pairedUid;
    existing.sources = [...new Set([...existing.sources, ...entry.sources])];
  }

  plan.lfCards = plan.lfCards.filter(
    (entry) => byIdentity.get(lfMatchKey(entry.credential)) === entry,
  );
}

function sectorsForBlocks(blockCount: number): number {
  if (blockCount >= 256) return 40;
  if (blockCount >= 64) return 16;
  return Math.max(1, Math.floor(blockCount / 4));
}

function finalizePlan(plan: IngestPlan, files: IngestFile[]): IngestPlan {
  const uids = new Set<string>();
  for (const entry of plan.dumps) if (entry.uid) uids.add(entry.uid);
  for (const entry of plan.lfCards) if (entry.pairedUid) uids.add(entry.pairedUid);

  plan.uids = [...uids];
  plan.dualFrequency = plan.dumps.length > 0 && plan.lfCards.length > 0;
  plan.suggestedName = suggestName(plan, files);
  return plan;
}

/** Folder name if the drop had one, else the card UID, else a generic label. */
function suggestName(plan: IngestPlan, files: IngestFile[]): string {
  const folder = files.find((file) => file.path.includes("/"))?.path.split("/")[0];
  if (folder) return folder;
  if (plan.uids.length) return `Card ${plan.uids[0]}`;
  if (plan.lfCards.length) return plan.lfCards[0].credential.name;
  return "Imported card";
}
