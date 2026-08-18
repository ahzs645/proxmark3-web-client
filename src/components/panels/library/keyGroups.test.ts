import { describe, expect, it } from "vite-plus/test";
import type { CachedDump } from "../CardMemoryMap";
import type { StoredCard, StoredKey } from "./types";
import { dumpDisplayName, groupKeysBySource } from "./utils";

function key(partial: Partial<StoredKey>): StoredKey {
  return {
    id: partial.id ?? Math.random().toString(16).slice(2),
    label: partial.label ?? "Key",
    value: partial.value ?? "FFFFFFFFFFFF",
    kind: partial.kind ?? "history",
    uidFilter: partial.uidFilter ?? "",
    sourceDumpId: partial.sourceDumpId ?? null,
    createdAt: partial.createdAt ?? 0,
    updatedAt: partial.updatedAt ?? 0,
  };
}

function dump(id: string, name: string, uid: string): CachedDump {
  return {
    id,
    name,
    uid,
    data: { Card: { UID: uid } },
    cachedAt: 0,
    favorite: false,
    notes: "",
    updatedAt: 0,
  } as CachedDump;
}

function card(uid: string, name: string): StoredCard {
  return {
    id: `card-${uid}`,
    name,
    uid,
    type: "MIFARE Classic",
    favorite: false,
    notes: "",
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("groupKeysBySource", () => {
  it("groups keys recovered in one dump under a single session", () => {
    const dumps = new Map([["d1", dump("d1", "hf-mf-84F0B240-dump.json", "84F0B240")]]);
    const keys = [
      key({ id: "a", uidFilter: "84F0B240", sourceDumpId: "d1", updatedAt: 5 }),
      key({ id: "b", uidFilter: "84F0B240", sourceDumpId: "d1", updatedAt: 6 }),
    ];

    const groups = groupKeysBySource(keys, dumps, []);

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("session");
    expect(groups[0].sourceDumpId).toBe("d1");
    expect(groups[0].uid).toBe("84F0B240");
    expect(groups[0].keys.map((k) => k.id).sort()).toEqual(["a", "b"]);
  });

  it("titles a session by its saved card name when one exists", () => {
    const dumps = new Map([["d1", dump("d1", "hf-mf-84F0B240-dump.json", "84F0B240")]]);
    const keys = [key({ uidFilter: "84F0B240", sourceDumpId: "d1" })];

    const groups = groupKeysBySource(keys, dumps, [card("84F0B240", "Office badge")]);

    expect(groups[0].title).toBe("Office badge");
  });

  it("collects untagged keys into a single common group placed last", () => {
    const dumps = new Map([["d1", dump("d1", "hf-mf-AABBCCDD-dump.json", "AABBCCDD")]]);
    const keys = [
      key({ id: "common1", kind: "public", value: "FFFFFFFFFFFF" }),
      key({ id: "session1", uidFilter: "AABBCCDD", sourceDumpId: "d1", updatedAt: 9 }),
    ];

    const groups = groupKeysBySource(keys, dumps, []);

    expect(groups).toHaveLength(2);
    expect(groups[0].kind).toBe("session");
    const common = groups[groups.length - 1];
    expect(common.kind).toBe("common");
    expect(common.id).toBe("common");
    expect(common.keys.map((k) => k.id)).toEqual(["common1"]);
  });

  it("groups UID-tagged keys with no surviving dump as a card group", () => {
    const keys = [key({ uidFilter: "11223344", sourceDumpId: "deleted-dump" })];

    const groups = groupKeysBySource(keys, new Map(), []);

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("card");
    expect(groups[0].sourceDumpId).toBeNull();
    expect(groups[0].uid).toBe("11223344");
  });
});

describe("dumpDisplayName", () => {
  it("prettifies the default pm3 export filename", () => {
    expect(dumpDisplayName(dump("d", "hf-mf-84F0B240-dump.json", "84F0B240"))).toBe(
      "MIFARE 84F0B240",
    );
  });

  it("keeps a user-given name, dropping only the extension", () => {
    expect(dumpDisplayName(dump("d", "My office badge.json", "84F0B240"))).toBe("My office badge");
  });
});
