import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "@voidzero-dev/vite-plus-test";
import { db } from "./db";
import { migrateLocalStorageToVault } from "./migrate";

function createLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
}

beforeEach(async () => {
  Object.assign(globalThis, { localStorage: createLocalStorage() });
  await Promise.all([db.dumps.clear(), db.keys.clear(), db.cards.clear(), db.assets.clear()]);
});

describe("migrateLocalStorageToVault", () => {
  it("imports the legacy localStorage stores into the vault", async () => {
    localStorage.setItem(
      "pm3-dumps",
      JSON.stringify([
        { id: "d1", name: "Office", cachedAt: 100, data: { Card: { UID: "DE AD BE EF" } } },
      ]),
    );
    localStorage.setItem(
      "pm3-library-dump-meta",
      JSON.stringify([{ dumpId: "d1", favorite: true, notes: "front door", updatedAt: 200 }]),
    );
    localStorage.setItem(
      "pm3-library-keys",
      JSON.stringify([
        {
          id: "k1",
          label: "A0",
          value: "A0A1A2A3A4A5",
          kind: "history",
          uidFilter: "DEADBEEF",
          createdAt: 1,
          updatedAt: 1,
        },
      ]),
    );
    localStorage.setItem(
      "pm3-library-cards",
      JSON.stringify([
        {
          id: "c1",
          name: "Office",
          uid: "DEADBEEF",
          type: "MIFARE 1K",
          favorite: false,
          notes: "",
          createdAt: 1,
          updatedAt: 1,
        },
      ]),
    );
    localStorage.setItem(
      "pm3-cache",
      JSON.stringify([
        {
          id: "a1",
          name: "hf-mf-DEADBEEF-dump.bin",
          kind: "dump",
          size: 1024,
          base64: "AAEC",
          updatedAt: 5,
        },
        { id: "a2", name: "no-data.bin", kind: "raw", size: 0 },
      ]),
    );

    await migrateLocalStorageToVault();

    expect(await db.dumps.count()).toBe(1);
    const dump = await db.dumps.get("d1");
    // dump-meta is merged into the dump row, and the UID is normalized.
    expect(dump?.uid).toBe("DEADBEEF");
    expect(dump?.favorite).toBe(true);
    expect(dump?.notes).toBe("front door");

    expect(await db.keys.count()).toBe(1);
    expect(await db.cards.count()).toBe(1);
    // The asset without base64 is skipped.
    expect(await db.assets.count()).toBe(1);

    expect(localStorage.getItem("pm3-vault-migrated")).toBe("1");
  });

  it("is idempotent across repeated runs", async () => {
    localStorage.setItem(
      "pm3-dumps",
      JSON.stringify([{ id: "d1", name: "X", cachedAt: 1, data: {} }]),
    );

    await migrateLocalStorageToVault();
    await migrateLocalStorageToVault();

    expect(await db.dumps.count()).toBe(1);
  });

  it("skips when the migration flag is already set", async () => {
    localStorage.setItem("pm3-vault-migrated", "1");
    localStorage.setItem(
      "pm3-dumps",
      JSON.stringify([{ id: "d9", name: "Y", cachedAt: 1, data: {} }]),
    );

    await migrateLocalStorageToVault();

    expect(await db.dumps.count()).toBe(0);
  });
});
