import type { CardType, PM3DumpJson, SectorKeysRecord } from "@/features/memory/types";
import type { CachedAssetKind } from "@/features/key-cache/types";
import type { ParsedLfCredential } from "@/features/lf-tools/formats";
import type { ParsedT55xxDetect } from "@/features/lf-tools/lfParse";

/** One file handed to the importer, already read into memory. */
export interface IngestFile {
  /** Display name (basename). */
  name: string;
  /** Path relative to the dropped folder, when one was dropped. */
  path: string;
  bytes: Uint8Array;
}

/** Where a dump's blocks were read from, best-first when the same card appears twice. */
export type DumpSourceFormat = "json" | "binary" | "mfu" | "eml" | "listing";

export interface IngestedDump {
  name: string;
  dump: PM3DumpJson;
  uid: string;
  cardType: CardType;
  format: DumpSourceFormat;
  blockCount: number;
  /** Files that contributed to this dump (blocks from one, keys from another). */
  sources: string[];
}

export interface IngestedLfCard {
  credential: ParsedLfCredential;
  carrier: ParsedT55xxDetect | null;
  /** UID of the HF side, when the capture note names one. */
  pairedUid: string;
  sources: string[];
}

export interface IngestedAsset {
  name: string;
  relativePath: string;
  kind: CachedAssetKind;
  bytes: Uint8Array;
}

/** A file the importer recognized but could not turn into vault data. */
export interface IngestSkip {
  name: string;
  reason: string;
}

/** Sector keys recovered from a companion key file, before they are matched. */
export interface IngestedKeySet {
  keys: SectorKeysRecord;
  sectors: number;
  source: string;
}

/**
 * What an import would add to the vault. Built without touching the database so
 * the summary can be shown — and cancelled — before anything is written.
 */
export interface IngestPlan {
  dumps: IngestedDump[];
  lfCards: IngestedLfCard[];
  assets: IngestedAsset[];
  /** Key sets that found no dump to attach to; still imported as library keys. */
  looseKeys: IngestedKeySet[];
  skipped: IngestSkip[];
  /** Distinct card UIDs seen across everything parsed. */
  uids: string[];
  /** Suggested virtual-card nickname, from the folder name or the UID. */
  suggestedName: string;
  /** True when the plan covers both an HF and an LF side. */
  dualFrequency: boolean;
}

export function emptyPlan(): IngestPlan {
  return {
    dumps: [],
    lfCards: [],
    assets: [],
    looseKeys: [],
    skipped: [],
    uids: [],
    suggestedName: "",
    dualFrequency: false,
  };
}

/** Total number of vault rows a plan would create. */
export function planItemCount(plan: IngestPlan): number {
  return plan.dumps.length + plan.lfCards.length + plan.assets.length + plan.looseKeys.length;
}
