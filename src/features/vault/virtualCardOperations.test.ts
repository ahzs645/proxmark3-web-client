import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db } from "./db";
import {
  clearAssets,
  deleteDump,
  deleteLfCard,
  deleteVirtualCard,
  linkVirtualCardMembers,
  putAsset,
  putDump,
  putLfCard,
  saveVirtualCard,
  setVirtualCardMembers,
  unlinkVirtualCardMember,
  type VirtualCardDraft,
} from "./operations";
import { memberId } from "./virtualCards";

function draft(overrides: Partial<VirtualCardDraft> = {}): VirtualCardDraft {
  return {
    name: "Office badge",
    form: "card",
    role: "original",
    issuer: "",
    color: "sky",
    tags: [],
    notes: "",
    favorite: false,
    ...overrides,
  };
}

beforeEach(async () => {
  await Promise.all([
    db.virtualCards.clear(),
    db.virtualCardMembers.clear(),
    db.dumps.clear(),
    db.lfCards.clear(),
    db.assets.clear(),
  ]);
});

describe("saveVirtualCard", () => {
  it("creates a row, then updates it in place keeping id and createdAt", async () => {
    const id = await saveVirtualCard(draft({ tags: ["work"] }));
    const created = await db.virtualCards.get(id);

    const sameId = await saveVirtualCard(
      draft({ id, name: "Front door badge", form: "fob", favorite: true }),
    );
    const updated = await db.virtualCards.get(id);

    expect(sameId).toBe(id);
    expect(await db.virtualCards.count()).toBe(1);
    expect(updated?.createdAt).toBe(created?.createdAt);
    expect(updated?.name).toBe("Front door badge");
    expect(updated?.form).toBe("fob");
    expect(updated?.favorite).toBe(true);
  });

  it("falls back to a placeholder name rather than storing an empty one", async () => {
    const id = await saveVirtualCard(draft({ name: "   " }));
    expect((await db.virtualCards.get(id))?.name).toBe("Untitled card");
  });
});

describe("membership", () => {
  it("links the same row twice without creating a duplicate edge", async () => {
    const id = await saveVirtualCard(draft());

    await linkVirtualCardMembers(id, [{ kind: "dump", refId: "d1" }]);
    await linkVirtualCardMembers(id, [{ kind: "dump", refId: "d1" }]);

    expect(await db.virtualCardMembers.count()).toBe(1);
  });

  it("diffs a replacement member set, keeping addedAt on rows that stay", async () => {
    const id = await saveVirtualCard(draft());
    await linkVirtualCardMembers(id, [
      { kind: "dump", refId: "d1" },
      { kind: "key", refId: "k1" },
    ]);
    const keptBefore = await db.virtualCardMembers.get(memberId(id, "dump", "d1"));

    await setVirtualCardMembers(id, [
      { kind: "dump", refId: "d1" },
      { kind: "lfCard", refId: "l1" },
    ]);

    const edges = await db.virtualCardMembers.where("virtualCardId").equals(id).toArray();
    expect(edges.map((edge) => `${edge.kind}:${edge.refId}`).sort()).toEqual([
      "dump:d1",
      "lfCard:l1",
    ]);
    expect(edges.find((edge) => edge.refId === "d1")?.addedAt).toBe(keptBefore?.addedAt);
  });

  it("detaches a single row", async () => {
    const id = await saveVirtualCard(draft());
    await linkVirtualCardMembers(id, [
      { kind: "dump", refId: "d1" },
      { kind: "dump", refId: "d2" },
    ]);

    await unlinkVirtualCardMember(id, "dump", "d1");

    const edges = await db.virtualCardMembers.where("virtualCardId").equals(id).toArray();
    expect(edges.map((edge) => edge.refId)).toEqual(["d2"]);
  });

  it("lets two virtual cards claim the same row", async () => {
    const original = await saveVirtualCard(draft());
    const clone = await saveVirtualCard(draft({ name: "Clone", role: "clone" }));

    await linkVirtualCardMembers(original, [{ kind: "dump", refId: "d1" }]);
    await linkVirtualCardMembers(clone, [{ kind: "dump", refId: "d1" }]);

    expect(await db.virtualCardMembers.where("refId").equals("d1").count()).toBe(2);
  });
});

describe("deleteVirtualCard", () => {
  it("removes the card and its edges, leaving other cards untouched", async () => {
    const id = await saveVirtualCard(draft());
    const other = await saveVirtualCard(draft({ name: "Gym fob" }));
    await linkVirtualCardMembers(id, [{ kind: "dump", refId: "d1" }]);
    await linkVirtualCardMembers(other, [{ kind: "dump", refId: "d2" }]);

    await deleteVirtualCard(id);

    expect(await db.virtualCards.get(id)).toBeUndefined();
    expect(await db.virtualCardMembers.where("virtualCardId").equals(id).count()).toBe(0);
    expect(await db.virtualCardMembers.where("virtualCardId").equals(other).count()).toBe(1);
  });
});

describe("pruning deleted members", () => {
  it("drops the edges for a deleted dump on every virtual card", async () => {
    const a = await saveVirtualCard(draft());
    const b = await saveVirtualCard(draft({ name: "Clone" }));
    await putDump({
      id: "d1",
      name: "dump",
      data: {} as never,
      uid: "04A2",
      cachedAt: 1,
      favorite: false,
      notes: "",
      updatedAt: 1,
    });
    await linkVirtualCardMembers(a, [
      { kind: "dump", refId: "d1" },
      { kind: "key", refId: "k1" },
    ]);
    await linkVirtualCardMembers(b, [{ kind: "dump", refId: "d1" }]);

    await deleteDump("d1");

    expect(await db.virtualCardMembers.where("refId").equals("d1").count()).toBe(0);
    expect(await db.virtualCardMembers.where("virtualCardId").equals(a).count()).toBe(1);
  });

  it("prunes an LF credential's edges but not a dump sharing its id", async () => {
    const id = await saveVirtualCard(draft());
    await putLfCard({
      id: "shared",
      name: "LF",
      uid: "1",
      tech: "hid",
      cachedAt: 1,
      favorite: false,
      notes: "",
      updatedAt: 1,
    });
    await linkVirtualCardMembers(id, [
      { kind: "lfCard", refId: "shared" },
      { kind: "dump", refId: "shared" },
    ]);

    await deleteLfCard("shared");

    const edges = await db.virtualCardMembers.where("virtualCardId").equals(id).toArray();
    expect(edges.map((edge) => edge.kind)).toEqual(["dump"]);
  });

  it("prunes every asset edge when the file cache is cleared", async () => {
    const id = await saveVirtualCard(draft());
    await putAsset({
      id: "a1",
      name: "keys.dic",
      kind: "dictionary",
      size: 4,
      base64: "AAAA",
      updatedAt: 1,
    });
    await linkVirtualCardMembers(id, [
      { kind: "asset", refId: "a1" },
      { kind: "dump", refId: "d1" },
    ]);

    await clearAssets();

    const edges = await db.virtualCardMembers.where("virtualCardId").equals(id).toArray();
    expect(edges.map((edge) => edge.kind)).toEqual(["dump"]);
  });
});
