import type { StoredCard, StoredKey } from "@/components/panels/library/types";
import type {
  AssetRecord,
  DumpRecord,
  LfCardRecord,
  VirtualCardForm,
  VirtualCardMemberKind,
  VirtualCardMemberRecord,
  VirtualCardRecord,
  VirtualCardRole,
} from "./db";
import { tagInfoFromDump } from "@/features/tag-info/fromDump";
import { normalizeUid } from "./uid";

/**
 * Everything the virtual-card layer knows about grouping. The vault's tables are
 * shaped by technology (HF cards, LF credentials, dumps, keys, files); a virtual
 * card is shaped by the physical object the user carries, and these helpers are
 * what turn one into the other. All pure — they operate on the arrays the Dexie
 * live queries already hand the Library panel.
 */

export const VIRTUAL_CARD_FORMS: { value: VirtualCardForm; label: string; hint: string }[] = [
  { value: "card", label: "Card", hint: "Credit-card sized badge" },
  { value: "fob", label: "Key fob", hint: "Keyring token" },
  { value: "tag", label: "Tag", hint: "Loose transponder / disc" },
  { value: "sticker", label: "Sticker", hint: "Adhesive inlay" },
  { value: "wristband", label: "Wristband", hint: "Band or bracelet" },
  { value: "implant", label: "Implant", hint: "Subdermal transponder" },
  { value: "ring", label: "Ring", hint: "Wearable ring" },
  { value: "phone", label: "Phone / wallet", hint: "Emulated credential" },
  { value: "other", label: "Other", hint: "Anything else" },
];

export const VIRTUAL_CARD_ROLES: { value: VirtualCardRole; label: string; hint: string }[] = [
  { value: "original", label: "Original", hint: "The issued credential itself" },
  { value: "clone", label: "Clone", hint: "A copy you wrote" },
  { value: "blank", label: "Blank", hint: "Magic / T5577 stock, ready to write" },
  { value: "test", label: "Test", hint: "Scratch card for experiments" },
];

/**
 * Swatch classes are spelled out rather than composed, because Tailwind only
 * emits classes it can find as literals in the source.
 */
export const VIRTUAL_CARD_COLORS: { value: string; label: string; dot: string }[] = [
  { value: "slate", label: "Slate", dot: "bg-slate-400" },
  { value: "red", label: "Red", dot: "bg-red-500" },
  { value: "amber", label: "Amber", dot: "bg-amber-500" },
  { value: "emerald", label: "Emerald", dot: "bg-emerald-500" },
  { value: "sky", label: "Sky", dot: "bg-sky-500" },
  { value: "violet", label: "Violet", dot: "bg-violet-500" },
  { value: "pink", label: "Pink", dot: "bg-pink-500" },
];

export function colorDotClass(color?: string): string {
  return VIRTUAL_CARD_COLORS.find((entry) => entry.value === color)?.dot ?? "bg-slate-400";
}

export function formLabel(form: VirtualCardForm): string {
  return VIRTUAL_CARD_FORMS.find((entry) => entry.value === form)?.label ?? "Card";
}

export function roleLabel(role: VirtualCardRole): string {
  return VIRTUAL_CARD_ROLES.find((entry) => entry.value === role)?.label ?? "Original";
}

/**
 * Short noun for a row's badge. Kept apart from {@link MEMBER_KIND_LABELS}
 * because a row shows its frequency in its own badge — "HF · card" rather than
 * "HF · HF card".
 */
export const MEMBER_KIND_TAGS: Record<VirtualCardMemberKind, string> = {
  card: "card",
  lfCard: "credential",
  dump: "dump",
  key: "key",
  asset: "file",
};

export const MEMBER_KIND_LABELS: Record<VirtualCardMemberKind, { one: string; many: string }> = {
  card: { one: "HF card", many: "HF cards" },
  lfCard: { one: "LF credential", many: "LF credentials" },
  dump: { one: "dump", many: "dumps" },
  key: { one: "key", many: "keys" },
  asset: { one: "file", many: "files" },
};

/** Frequencies a virtual card covers, derived from what is linked to it. */
export type VirtualCardFrequency = "hf" | "lf" | "dual" | "empty";

/** The pools a virtual card resolves its members out of. */
export interface VirtualCardPools {
  cards: StoredCard[];
  lfCards: LfCardRecord[];
  dumps: DumpRecord[];
  keys: StoredKey[];
  assets: AssetRecord[];
}

export interface VirtualCardMembers {
  card: StoredCard[];
  lfCard: LfCardRecord[];
  dump: DumpRecord[];
  key: StoredKey[];
  asset: AssetRecord[];
}

export interface ResolvedVirtualCard {
  record: VirtualCardRecord;
  members: VirtualCardMembers;
  memberCount: number;
  frequency: VirtualCardFrequency;
  /** Distinct UIDs seen across the HF/LF members, newest-linked first. */
  uids: string[];
  /** Human-readable technologies present, e.g. ["MIFARE Classic 1K", "HID"]. */
  technologies: string[];
}

export const EMPTY_POOLS: VirtualCardPools = {
  cards: [],
  lfCards: [],
  dumps: [],
  keys: [],
  assets: [],
};

/** Deterministic membership id, so linking the same row twice is idempotent. */
export function memberId(
  virtualCardId: string,
  kind: VirtualCardMemberKind,
  refId: string,
): string {
  return `${virtualCardId}:${kind}:${refId}`;
}

/** Key used to look a record up in the membership index. */
export function memberRefKey(kind: VirtualCardMemberKind, refId: string): string {
  return `${kind}:${refId}`;
}

function emptyMembers(): VirtualCardMembers {
  return { card: [], lfCard: [], dump: [], key: [], asset: [] };
}

function poolIndex(pools: VirtualCardPools) {
  return {
    card: new Map(pools.cards.map((row) => [row.id, row] as const)),
    lfCard: new Map(pools.lfCards.map((row) => [row.id, row] as const)),
    dump: new Map(pools.dumps.map((row) => [row.id, row] as const)),
    key: new Map(pools.keys.map((row) => [row.id, row] as const)),
    asset: new Map(pools.assets.map((row) => [row.id, row] as const)),
  };
}

/** The frequency badge a set of members earns. */
export function membersFrequency(members: VirtualCardMembers): VirtualCardFrequency {
  const hf = members.card.length > 0 || members.dump.length > 0;
  const lf = members.lfCard.length > 0;
  if (hf && lf) return "dual";
  if (hf) return "hf";
  if (lf) return "lf";
  return "empty";
}

export function frequencyLabel(frequency: VirtualCardFrequency): string {
  if (frequency === "dual") return "Dual frequency";
  if (frequency === "hf") return "HF · 13.56 MHz";
  if (frequency === "lf") return "LF · 125 kHz";
  return "Nothing linked";
}

function technologiesOf(members: VirtualCardMembers): string[] {
  const seen = new Set<string>();
  for (const card of members.card) {
    const label = (card.type || "").trim();
    if (label) seen.add(label);
  }
  for (const lf of members.lfCard) {
    seen.add(lf.format ? `${lf.tech.toUpperCase()} ${lf.format}` : lf.tech.toUpperCase());
  }
  return [...seen];
}

function uidsOf(members: VirtualCardMembers): string[] {
  const seen = new Set<string>();
  for (const card of members.card) {
    const uid = normalizeUid(card.uid);
    if (uid) seen.add(uid);
  }
  for (const lf of members.lfCard) {
    const uid = normalizeUid(lf.uid);
    if (uid) seen.add(uid);
  }
  for (const dump of members.dump) {
    const uid = normalizeUid(dump.uid);
    if (uid) seen.add(uid);
  }
  return [...seen];
}

/**
 * Hydrate one virtual card's membership edges into the actual rows. Edges whose
 * target no longer exists (the dump was deleted, say) are simply skipped, so a
 * dangling link degrades to "one fewer member" instead of a crash.
 */
export function resolveVirtualCard(
  record: VirtualCardRecord,
  edges: VirtualCardMemberRecord[],
  pools: VirtualCardPools,
): ResolvedVirtualCard {
  const index = poolIndex(pools);
  const members = emptyMembers();

  for (const edge of edges) {
    if (edge.virtualCardId !== record.id) continue;
    switch (edge.kind) {
      case "card": {
        const row = index.card.get(edge.refId);
        if (row) members.card.push(row);
        break;
      }
      case "lfCard": {
        const row = index.lfCard.get(edge.refId);
        if (row) members.lfCard.push(row);
        break;
      }
      case "dump": {
        const row = index.dump.get(edge.refId);
        if (row) members.dump.push(row);
        break;
      }
      case "key": {
        const row = index.key.get(edge.refId);
        if (row) members.key.push(row);
        break;
      }
      case "asset": {
        const row = index.asset.get(edge.refId);
        if (row) members.asset.push(row);
        break;
      }
    }
  }

  return {
    record,
    members,
    memberCount:
      members.card.length +
      members.lfCard.length +
      members.dump.length +
      members.key.length +
      members.asset.length,
    frequency: membersFrequency(members),
    uids: uidsOf(members),
    technologies: technologiesOf(members),
  };
}

/** Resolve every virtual card, favourites first then most recently touched. */
export function resolveVirtualCards(
  records: VirtualCardRecord[],
  edges: VirtualCardMemberRecord[],
  pools: VirtualCardPools,
): ResolvedVirtualCard[] {
  const byCard = new Map<string, VirtualCardMemberRecord[]>();
  for (const edge of edges) {
    const list = byCard.get(edge.virtualCardId);
    if (list) list.push(edge);
    else byCard.set(edge.virtualCardId, [edge]);
  }

  return records
    .map((record) => resolveVirtualCard(record, byCard.get(record.id) ?? [], pools))
    .sort((a, b) => {
      if (a.record.favorite !== b.record.favorite) {
        return Number(b.record.favorite) - Number(a.record.favorite);
      }
      return b.record.updatedAt - a.record.updatedAt;
    });
}

/**
 * Reverse index for the other library tabs: which virtual cards claim a given
 * row. A dump can legitimately belong to more than one (an original and the
 * clone written from it), so this maps to a list rather than a single owner.
 */
export function membershipIndex(
  records: VirtualCardRecord[],
  edges: VirtualCardMemberRecord[],
): Map<string, VirtualCardRecord[]> {
  const byId = new Map(records.map((record) => [record.id, record] as const));
  const index = new Map<string, VirtualCardRecord[]>();

  for (const edge of edges) {
    const record = byId.get(edge.virtualCardId);
    if (!record) continue;
    const key = memberRefKey(edge.kind, edge.refId);
    const list = index.get(key);
    if (list) list.push(record);
    else index.set(key, [record]);
  }

  return index;
}

/** The set of `kind:refId` keys already linked to a virtual card. */
export function linkedKeysFor(
  virtualCardId: string,
  edges: VirtualCardMemberRecord[],
): Set<string> {
  const keys = new Set<string>();
  for (const edge of edges) {
    if (edge.virtualCardId === virtualCardId) keys.add(memberRefKey(edge.kind, edge.refId));
  }
  return keys;
}

/** One candidate row the picker can attach. */
export interface MemberCandidate {
  kind: VirtualCardMemberKind;
  refId: string;
  label: string;
  detail: string;
  uid: string;
  updatedAt: number;
  /** Which side of the card this row belongs to, when the row implies one. */
  protocol?: "HF" | "LF";
  /** Technology label, e.g. "MIFARE Classic 4K" — blank when not derivable. */
  typeLabel?: string;
  /** Dump a key was recovered from, when that dump is also in the vault. */
  parentDumpId?: string;
  /** Folder a file was imported from, used to group captures together. */
  folder?: string;
}

/** Directory part of an imported file's path, "" for a loose file. */
export function folderOf(relativePath?: string): string | undefined {
  if (!relativePath?.includes("/")) return undefined;
  return relativePath.slice(0, relativePath.lastIndexOf("/"));
}

/** Flatten every vault row into pickable candidates, newest first per kind. */
export function memberCandidates(pools: VirtualCardPools): MemberCandidate[] {
  const dumpIds = new Set(pools.dumps.map((row) => row.id));
  const candidates: MemberCandidate[] = [
    ...pools.cards.map((row) => ({
      kind: "card" as const,
      refId: row.id,
      label: row.name || `Card ${row.uid}`,
      detail: [row.type, row.uid].filter(Boolean).join(" · "),
      uid: normalizeUid(row.uid),
      updatedAt: row.updatedAt,
      // The library's card records are the 13.56 MHz catalogue; LF reads get
      // their own table, so a card row is always the HF side.
      protocol: "HF" as const,
      typeLabel: row.type || undefined,
    })),
    ...pools.lfCards.map((row) => ({
      kind: "lfCard" as const,
      refId: row.id,
      label: row.name || "LF card",
      detail: [row.tech.toUpperCase(), row.format, row.raw].filter(Boolean).join(" · "),
      uid: normalizeUid(row.uid),
      updatedAt: row.updatedAt,
      protocol: "LF" as const,
      typeLabel: row.format ? `${row.tech.toUpperCase()} ${row.format}` : row.tech.toUpperCase(),
    })),
    ...pools.dumps.map((row) => {
      // A memory dump is always a 13.56 MHz card; the same helper the Tag Info
      // panel uses names the technology from the dump's own contents.
      const identity = tagInfoFromDump(row.data);
      return {
        kind: "dump" as const,
        refId: row.id,
        label: row.name,
        detail: [identity?.type, row.uid || "no UID"].filter(Boolean).join(" · "),
        uid: normalizeUid(row.uid),
        updatedAt: row.cachedAt,
        protocol: "HF" as const,
        typeLabel: identity?.type,
      };
    }),
    ...pools.keys.map((row) => ({
      kind: "key" as const,
      refId: row.id,
      label: row.label || row.value,
      detail: [row.value, row.uidFilter || "global"].filter(Boolean).join(" · "),
      uid: normalizeUid(row.uidFilter),
      updatedAt: row.updatedAt,
      // Library keys are 6-byte MIFARE sector keys — an HF concept.
      protocol: "HF" as const,
      // Only treat the link as a parent if that dump is still in the vault;
      // otherwise the key would nest under a row that is not rendered.
      parentDumpId:
        row.sourceDumpId && dumpIds.has(row.sourceDumpId) ? row.sourceDumpId : undefined,
    })),
    ...pools.assets.map((row) => ({
      kind: "asset" as const,
      refId: row.id,
      label: row.name,
      detail: row.relativePath || row.kind,
      uid: "",
      updatedAt: row.updatedAt,
      folder: folderOf(row.relativePath),
    })),
  ];

  return candidates.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * One pickable row, with anything the vault records as belonging to it nested
 * underneath — the keys recovered from a dump, for instance.
 */
export interface CandidateEntry {
  candidate: MemberCandidate;
  children: MemberCandidate[];
  /** Shown in place of children when there are none, e.g. a dump with no keys. */
  emptyHint?: string;
}

/** A headed block of the attach picker. */
export interface CandidateSection {
  id: string;
  title: string;
  entries: CandidateEntry[];
}

const KIND_ORDER: VirtualCardMemberKind[] = ["card", "lfCard", "dump", "key", "asset"];

const flat = (rows: MemberCandidate[]): CandidateEntry[] =>
  rows.map((candidate) => ({ candidate, children: [] as MemberCandidate[] }));

/**
 * Organize every attachable row into the picker's sections. Grouping follows
 * links that already exist in the vault — a key's source dump, a file's import
 * folder — so nothing here invents a relationship the data does not record.
 * Every section carries its own heading, so no block can read as a continuation
 * of the one above it.
 */
export function candidateSections(candidates: MemberCandidate[]): CandidateSection[] {
  const byKind = new Map<VirtualCardMemberKind, MemberCandidate[]>();
  for (const candidate of candidates) {
    const list = byKind.get(candidate.kind);
    if (list) list.push(candidate);
    else byKind.set(candidate.kind, [candidate]);
  }

  const sections: CandidateSection[] = [];

  for (const kind of KIND_ORDER) {
    const rows = byKind.get(kind) ?? [];
    if (!rows.length) continue;

    if (kind === "dump") {
      const keys = byKind.get("key") ?? [];
      sections.push({
        id: "dumps",
        title: MEMBER_KIND_LABELS.dump.many,
        entries: rows.map((dump) => ({
          candidate: dump,
          children: keys.filter((key) => key.parentDumpId === dump.refId),
          emptyHint: "No keys were recovered from this dump",
        })),
      });
      continue;
    }

    if (kind === "key") {
      // Keys that belong to a dump are shown nested under it, above.
      const loose = rows.filter((key) => !key.parentDumpId);
      if (loose.length) {
        sections.push({ id: "keys:loose", title: "Keys not tied to a dump", entries: flat(loose) });
      }
      continue;
    }

    if (kind === "asset") {
      const folders = new Map<string, MemberCandidate[]>();
      for (const row of rows) {
        const folder = row.folder ?? "";
        const list = folders.get(folder);
        if (list) list.push(row);
        else folders.set(folder, [row]);
      }
      for (const [folder, list] of folders) {
        sections.push({
          id: `files:${folder || "loose"}`,
          title: folder ? `Files from ${folder}` : "Files",
          entries: flat(list),
        });
      }
      continue;
    }

    sections.push({
      id: `kind:${kind}`,
      title: MEMBER_KIND_LABELS[kind].many,
      entries: flat(rows),
    });
  }

  return sections;
}

/** Ref keys an entry owns: the row itself plus everything nested under it. */
export function entryRefKeys(entry: CandidateEntry): string[] {
  return [
    memberRefKey(entry.candidate.kind, entry.candidate.refId),
    ...entry.children.map((child) => memberRefKey(child.kind, child.refId)),
  ];
}

/** Every ref key a section owns, across all of its entries. */
export function sectionRefKeys(section: CandidateSection): string[] {
  return section.entries.flatMap(entryRefKeys);
}

/** Drop rows that do not match a predicate, keeping an entry whose parent does. */
export function filterSections(
  sections: CandidateSection[],
  matches: (row: MemberCandidate) => boolean,
): CandidateSection[] {
  return sections
    .map((section) => ({
      ...section,
      entries: section.entries
        .map((entry) => ({ ...entry, children: entry.children.filter(matches) }))
        .filter((entry) => matches(entry.candidate) || entry.children.length > 0),
    }))
    .filter((section) => section.entries.length > 0);
}

/**
 * Rows that share a UID with something already linked, but aren't linked yet.
 * This is what makes a dual-frequency card cheap to assemble: link the HF side
 * once and every dump and recovered key for that UID is offered in one click.
 */
export function suggestedMembers(
  resolved: ResolvedVirtualCard,
  pools: VirtualCardPools,
  edges: VirtualCardMemberRecord[],
): MemberCandidate[] {
  const uids = new Set(resolved.uids);
  if (!uids.size) return [];

  const linked = linkedKeysFor(resolved.record.id, edges);
  return memberCandidates(pools).filter(
    (candidate) =>
      candidate.uid !== "" &&
      uids.has(candidate.uid) &&
      !linked.has(memberRefKey(candidate.kind, candidate.refId)),
  );
}

/** Text match across a virtual card's own fields plus its members' labels. */
export function matchesVirtualCardSearch(resolved: ResolvedVirtualCard, query: string): boolean {
  const needle = query.trim().toUpperCase();
  if (!needle) return true;

  const haystack = [
    resolved.record.name,
    resolved.record.issuer ?? "",
    resolved.record.notes,
    formLabel(resolved.record.form),
    roleLabel(resolved.record.role),
    ...resolved.record.tags,
    ...resolved.uids,
    ...resolved.technologies,
    ...resolved.members.card.map((row) => row.name),
    ...resolved.members.lfCard.map((row) => row.name),
    ...resolved.members.dump.map((row) => row.name),
  ]
    .join(" ")
    .toUpperCase();

  return haystack.includes(needle);
}

/** "1 HF card · 2 dumps · 12 keys" — the one-line member summary for a row. */
export function summarizeMembers(members: VirtualCardMembers): string {
  const parts: string[] = [];
  const order: VirtualCardMemberKind[] = ["card", "lfCard", "dump", "key", "asset"];

  for (const kind of order) {
    const count = members[kind].length;
    if (!count) continue;
    const label = MEMBER_KIND_LABELS[kind];
    parts.push(`${count} ${count === 1 ? label.one : label.many}`);
  }

  return parts.length ? parts.join(" · ") : "Nothing linked yet";
}

/** Split a comma/newline separated tag input into clean, de-duplicated tags. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const raw of input.split(/[,\n]/)) {
    const tag = raw.trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }

  return tags;
}
