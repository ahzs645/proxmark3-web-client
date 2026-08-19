import { describe, expect, it } from "vite-plus/test";
import type { StoredCard, StoredKey } from "../../components/panels/library/types";
import type {
  AssetRecord,
  DumpRecord,
  LfCardRecord,
  VirtualCardMemberRecord,
  VirtualCardRecord,
} from "./db";
import {
  EMPTY_POOLS,
  MEMBER_KIND_TAGS,
  candidateSections,
  memberCandidates,
  memberId,
  membershipIndex,
  parseTags,
  resolveVirtualCards,
  suggestedMembers,
  entryRefKeys,
  filterSections,
  sectionRefKeys,
  summarizeMembers,
  type CandidateEntry,
  type CandidateSection,
  type VirtualCardPools,
} from "./virtualCards";

const UID = "04A23BC2";

function virtualCard(overrides: Partial<VirtualCardRecord> = {}): VirtualCardRecord {
  return {
    id: "vc1",
    name: "Office badge",
    form: "card",
    role: "original",
    tags: [],
    favorite: false,
    notes: "",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function edge(
  virtualCardId: string,
  kind: VirtualCardMemberRecord["kind"],
  refId: string,
): VirtualCardMemberRecord {
  return { id: memberId(virtualCardId, kind, refId), virtualCardId, kind, refId, addedAt: 1 };
}

const hfCard: StoredCard = {
  id: "c1",
  name: "Badge HF side",
  uid: UID,
  type: "MIFARE Classic 1K",
  favorite: false,
  notes: "",
  createdAt: 1,
  updatedAt: 1,
};

const lfCard: LfCardRecord = {
  id: "l1",
  name: "Badge LF side",
  uid: "2004123456",
  tech: "hid",
  format: "H10301",
  cachedAt: 1,
  favorite: false,
  notes: "",
  updatedAt: 1,
};

const dump: DumpRecord = {
  id: "d1",
  name: "hf-mf-04A23BC2-dump.json",
  data: {} as DumpRecord["data"],
  uid: UID,
  cachedAt: 5,
  favorite: false,
  notes: "",
  updatedAt: 5,
};

const key: StoredKey = {
  id: "k1",
  label: "Sector 0 Key A",
  value: "FFFFFFFFFFFF",
  kind: "history",
  uidFilter: UID,
  sourceDumpId: "d1",
  createdAt: 1,
  updatedAt: 1,
};

const pools: VirtualCardPools = {
  ...EMPTY_POOLS,
  cards: [hfCard],
  lfCards: [lfCard],
  dumps: [dump],
  keys: [key],
};

describe("resolveVirtualCards", () => {
  it("assembles an HF row and an LF row into one dual-frequency card", () => {
    const edges = [edge("vc1", "card", "c1"), edge("vc1", "lfCard", "l1")];

    const [resolved] = resolveVirtualCards([virtualCard()], edges, pools);

    expect(resolved.frequency).toBe("dual");
    expect(resolved.memberCount).toBe(2);
    expect(resolved.members.card).toEqual([hfCard]);
    expect(resolved.members.lfCard).toEqual([lfCard]);
    expect(resolved.technologies).toEqual(["MIFARE Classic 1K", "HID H10301"]);
    expect(resolved.uids).toEqual([UID, "2004123456"]);
  });

  it("reports single-frequency cards by which side is linked", () => {
    const hfOnly = resolveVirtualCards([virtualCard()], [edge("vc1", "dump", "d1")], pools);
    const lfOnly = resolveVirtualCards([virtualCard()], [edge("vc1", "lfCard", "l1")], pools);
    const bare = resolveVirtualCards([virtualCard()], [], pools);

    expect(hfOnly[0].frequency).toBe("hf");
    expect(lfOnly[0].frequency).toBe("lf");
    expect(bare[0].frequency).toBe("empty");
  });

  it("skips membership edges whose target row was deleted", () => {
    const edges = [edge("vc1", "card", "c1"), edge("vc1", "dump", "gone")];

    const [resolved] = resolveVirtualCards([virtualCard()], edges, pools);

    expect(resolved.memberCount).toBe(1);
    expect(resolved.members.dump).toEqual([]);
  });

  it("sorts favourites first, then most recently updated", () => {
    const records = [
      virtualCard({ id: "a", name: "A", updatedAt: 300 }),
      virtualCard({ id: "b", name: "B", updatedAt: 100, favorite: true }),
      virtualCard({ id: "c", name: "C", updatedAt: 200 }),
    ];

    expect(resolveVirtualCards(records, [], pools).map((entry) => entry.record.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });
});

describe("suggestedMembers", () => {
  it("offers unlinked rows that share a UID with something already linked", () => {
    const edges = [edge("vc1", "card", "c1")];
    const [resolved] = resolveVirtualCards([virtualCard()], edges, pools);

    const suggestions = suggestedMembers(resolved, pools, edges);

    expect(suggestions.map((entry) => `${entry.kind}:${entry.refId}`)).toEqual([
      "dump:d1",
      "key:k1",
    ]);
  });

  it("suggests nothing once every matching row is linked", () => {
    const edges = [edge("vc1", "card", "c1"), edge("vc1", "dump", "d1"), edge("vc1", "key", "k1")];
    const [resolved] = resolveVirtualCards([virtualCard()], edges, pools);

    expect(suggestedMembers(resolved, pools, edges)).toEqual([]);
  });

  it("suggests nothing for a card with no UID-bearing members yet", () => {
    const [resolved] = resolveVirtualCards([virtualCard()], [], pools);

    expect(suggestedMembers(resolved, pools, [])).toEqual([]);
  });
});

describe("membershipIndex", () => {
  it("maps a row back to every virtual card claiming it", () => {
    const records = [virtualCard({ id: "vc1" }), virtualCard({ id: "vc2", name: "Clone" })];
    const edges = [edge("vc1", "dump", "d1"), edge("vc2", "dump", "d1")];

    const index = membershipIndex(records, edges);

    expect(index.get("dump:d1")?.map((entry) => entry.id)).toEqual(["vc1", "vc2"]);
    expect(index.get("card:c1")).toBeUndefined();
  });

  it("ignores edges pointing at a deleted virtual card", () => {
    expect(membershipIndex([], [edge("gone", "dump", "d1")]).size).toBe(0);
  });
});

describe("summarizeMembers", () => {
  it("pluralizes each member kind and keeps a stable order", () => {
    const edges = [
      edge("vc1", "card", "c1"),
      edge("vc1", "lfCard", "l1"),
      edge("vc1", "dump", "d1"),
      edge("vc1", "key", "k1"),
    ];
    const [resolved] = resolveVirtualCards([virtualCard()], edges, pools);

    expect(summarizeMembers(resolved.members)).toBe("1 HF card · 1 LF credential · 1 dump · 1 key");
  });

  it("says so when nothing is linked", () => {
    const [resolved] = resolveVirtualCards([virtualCard()], [], pools);

    expect(summarizeMembers(resolved.members)).toBe("Nothing linked yet");
  });
});

describe("parseTags", () => {
  it("splits, trims and de-duplicates case-insensitively", () => {
    expect(parseTags(" work, Door Access ,work\ndoor access, ")).toEqual(["work", "Door Access"]);
  });

  it("returns nothing for an empty input", () => {
    expect(parseTags("  ,  ")).toEqual([]);
  });
});

describe("candidateSections", () => {
  const dumpB: DumpRecord = { ...dump, id: "d2", name: "other.bin", uid: "AABBCCDD" };
  const looseKey: StoredKey = {
    id: "k2",
    label: "Common FFFFFFFFFFFF",
    value: "FFFFFFFFFFFF",
    kind: "public",
    uidFilter: "",
    createdAt: 1,
    updatedAt: 1,
  };
  const orphanKey: StoredKey = { ...key, id: "k3", sourceDumpId: "deleted-dump" };

  const assets: AssetRecord[] = [
    {
      id: "a1",
      name: "autopwn.log",
      relativePath: "card-dumps/autopwn.log",
      kind: "raw",
      size: 1,
      base64: "",
      updatedAt: 1,
    },
    {
      id: "a2",
      name: "README.md",
      relativePath: "card-dumps/README.md",
      kind: "raw",
      size: 1,
      base64: "",
      updatedAt: 1,
    },
    {
      id: "a3",
      name: "loose.dic",
      relativePath: "loose.dic",
      kind: "keys",
      size: 1,
      base64: "",
      updatedAt: 1,
    },
  ];

  const richPools: VirtualCardPools = {
    cards: [hfCard],
    lfCards: [lfCard],
    dumps: [dump, dumpB],
    keys: [key, looseKey, orphanKey],
    assets,
  };

  const sectionsOf = () => candidateSections(memberCandidates(richPools));
  const byId = (id: string) => sectionsOf().find((section) => section.id === id);

  it("gives every section its own heading, so none reads as part of the one above", () => {
    expect(sectionsOf().map((section) => section.title)).toEqual([
      "HF cards",
      "LF credentials",
      "dumps",
      "Keys not tied to a dump",
      "Files from card-dumps",
      "Files",
    ]);
  });

  it("nests a recovered key under the dump it came from", () => {
    const entry = byId("dumps")?.entries.find((row) => row.candidate.refId === "d1");

    expect(entry?.children.map((child) => child.refId)).toEqual(["k1"]);
  });

  it("does not repeat a nested key in the loose-keys section", () => {
    expect(
      byId("keys:loose")
        ?.entries.map((entry) => entry.candidate.refId)
        .sort(),
    ).toEqual(["k2", "k3"]);
  });

  it("shows a dump with no recovered keys, with a hint instead of children", () => {
    const entry = byId("dumps")?.entries.find((row) => row.candidate.refId === "d2");

    expect(entry?.children).toEqual([]);
    expect(entry?.emptyHint).toBe("No keys were recovered from this dump");
  });

  it("keeps a key whose source dump was deleted out of the nesting", () => {
    const candidates = memberCandidates(richPools);

    expect(candidates.find((row) => row.refId === "k3")?.parentDumpId).toBeUndefined();
    expect(candidates.find((row) => row.refId === "k1")?.parentDumpId).toBe("d1");
  });

  it("groups files by the folder they were imported from", () => {
    expect(byId("files:card-dumps")?.entries.map((entry) => entry.candidate.refId)).toEqual([
      "a1",
      "a2",
    ]);
    expect(byId("files:loose")?.title).toBe("Files");
  });

  it("collects a row's own key plus its nested children", () => {
    const entry = byId("dumps")?.entries.find((row) => row.candidate.refId === "d1");

    expect(entryRefKeys(entry as CandidateEntry)).toEqual(["dump:d1", "key:k1"]);
    expect(sectionRefKeys(byId("dumps") as CandidateSection)).toEqual([
      "dump:d1",
      "key:k1",
      "dump:d2",
    ]);
  });

  it("keeps a dump visible when a search matches only its nested key", () => {
    const filtered = filterSections(sectionsOf(), (row) => row.label === "Sector 0 Key A");
    const dumps = filtered.find((section) => section.id === "dumps");

    expect(dumps?.entries).toHaveLength(1);
    expect(dumps?.entries[0].candidate.refId).toBe("d1");
    expect(dumps?.entries[0].children.map((child) => child.refId)).toEqual(["k1"]);
  });
});

describe("candidate tagging", () => {
  const pools4k: VirtualCardPools = {
    ...EMPTY_POOLS,
    cards: [hfCard],
    lfCards: [lfCard],
    keys: [key],
    dumps: [
      {
        ...dump,
        uid: "84F0B240",
        data: {
          Card: { UID: "84F0B240", SAK: "18" },
          blocks: Object.fromEntries(
            Array.from({ length: 256 }, (_, block) => [String(block), "00".repeat(16)]),
          ),
        },
      },
    ],
  };

  const find = (refId: string) => memberCandidates(pools4k).find((row) => row.refId === refId);

  it("tags a memory dump as HF and names its technology from the dump itself", () => {
    const candidate = find("d1");

    expect(candidate?.protocol).toBe("HF");
    expect(candidate?.typeLabel).toBe("MIFARE Classic 4K");
    expect(candidate?.detail).toBe("MIFARE Classic 4K · 84F0B240");
  });

  it("tags card records and sector keys as HF, LF credentials as LF", () => {
    expect(find("c1")?.protocol).toBe("HF");
    expect(find("k1")?.protocol).toBe("HF");
    expect(find("l1")?.protocol).toBe("LF");
  });

  it("names each row's kind without repeating the frequency", () => {
    expect(MEMBER_KIND_TAGS.card).toBe("card");
    expect(MEMBER_KIND_TAGS.lfCard).toBe("credential");
    expect(MEMBER_KIND_TAGS.dump).toBe("dump");
  });

  it("leaves a file untagged, since a log implies no frequency", () => {
    const candidates = memberCandidates({
      ...EMPTY_POOLS,
      assets: [
        {
          id: "a1",
          name: "run.log",
          relativePath: "run.log",
          kind: "raw",
          size: 1,
          base64: "",
          updatedAt: 1,
        },
      ],
    });

    expect(candidates[0].protocol).toBeUndefined();
  });
});
