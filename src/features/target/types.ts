import type { CachedDump } from "@/components/panels/CardMemoryMap";
import type { StoredKey } from "@/components/panels/library/types";
import type { CachedAsset } from "@/features/key-cache/types";
import type { MagicCardType } from "@/features/magic/types";
import type { TagInfo } from "@/features/tag-info/types";

export type CardSize = "1k" | "4k" | "mini" | "unknown";
export type CardFamily = "classic" | "ultralight" | "iclass" | "desfire" | "lf" | "unknown";

/** How the workbench learned about the current card. */
export type CardSource = "scan" | "dump" | "manual" | null;

/**
 * Normalized view of what kind of card the active target is. Derived once from
 * the raw {@link TagInfo} so every panel classifies a card the same way instead
 * of each re-running its own string matching.
 */
export interface CardClassification {
  family: CardFamily;
  size: CardSize;
  protocol: "HF" | "LF" | "unknown";
  isClassic: boolean;
  isUltralight: boolean;
  isIclass: boolean;
  isDesfire: boolean;
}

/**
 * The single "active card" the entire workbench operates on. Unifies the three
 * pieces of state that used to live apart in App.tsx — the scanned identity, the
 * active memory dump, and the keys recovered for it — behind one object so a
 * card scanned in one panel is the same card every other panel sees.
 */
export interface CardTarget {
  identity: TagInfo | null;
  dump: CachedDump | null;
  source: CardSource;
  classification: CardClassification;
  /** The card's UID (from identity, falling back to the active dump). */
  uid: string;
  /** Library keys that apply to this card (UID-tagged plus global). */
  savedKeys: StoredKey[];
  /** Number of unique, usable keys saved for this card's UID. */
  savedKeyCount: number;
  /** Every structured key in the Library, regardless of UID metadata. */
  libraryKeys: StoredKey[];
  /** Number of unique, usable keys available across the entire Library. */
  libraryKeyCount: number;
  /** Other cached dumps in the vault sharing this card's UID. */
  relatedDumps: CachedDump[];
  /** Cached files in the vault whose name references this card's UID. */
  relatedAssets: CachedAsset[];
  /** True once we know anything about a card (identity and/or a dump). */
  hasCard: boolean;
  /** Latest LF carrier detect result (writable T5577 check), if any. */
  lf: LfIdentifyState | null;
  /** Latest HF magic-card detect result, if any. */
  magic: MagicIdentifyState | null;
  updatedAt: number;
}

/**
 * The result of an LF carrier check (`lf t55xx detect`). A writable T5577/T5555
 * is LF's equivalent of a "magic" card — it is what clones get written to.
 */
export interface LfIdentifyState {
  chip?: string;
  config?: string;
  passwordSet?: boolean;
  writable: boolean;
  /** Human-readable reason a carrier check could not identify a card. */
  error?: string;
  at: number;
}

/** The result of an HF magic-card check (`hf mf info`). */
export interface MagicIdentifyState {
  isMagic: boolean;
  gen: MagicCardType;
  label: string;
  at: number;
}

export interface CardTargetContextValue {
  target: CardTarget;
  /** Merge new identity fields (e.g. from a scan or a dump) into the target. */
  mergeIdentity: (identity: Partial<TagInfo>, source?: CardSource) => void;
  /** Replace identity wholesale, or clear it with `null`. */
  setIdentity: (identity: TagInfo | null, source?: CardSource) => void;
  /** Record the outcome of an LF carrier detect, for the write/clone UI to gate on. */
  noteLfIdentify: (info: LfIdentifyState) => void;
  /** Record the outcome of an HF magic detect, for the Magic panel to gate on. */
  noteMagicIdentify: (info: MagicIdentifyState) => void;
  /** Forget the current card identity (the dump store is cleared separately). */
  clearTarget: () => void;
}
