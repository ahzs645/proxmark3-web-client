import type { PM3DumpJson } from "@/components/panels/CardMemoryMap";
import type { StoredCard, StoredDumpMeta, StoredKey } from "@/components/panels/library/types";
import type { CachedAssetKind } from "@/features/key-cache/types";
import { db, type AssetRecord, type DumpRecord } from "./db";
import { normalizeUid } from "./uid";

const MIGRATION_FLAG = "pm3-vault-migrated";

// Legacy localStorage keys the data used to live under.
const LEGACY = {
  dumps: "pm3-dumps",
  dumpMeta: "pm3-library-dump-meta",
  keys: "pm3-library-keys",
  cards: "pm3-library-cards",
  assets: "pm3-cache",
} as const;

interface LegacyDump {
  id: string;
  name: string;
  data: PM3DumpJson;
  cachedAt: number;
}

interface LegacyAsset {
  id: string;
  name: string;
  relativePath?: string;
  kind: CachedAssetKind;
  size: number;
  base64?: string;
  updatedAt?: number;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * One-time import of the legacy localStorage stores into the Dexie vault. Runs
 * before the app renders (see main.tsx). Idempotent: guarded by a flag and only
 * fills empty tables, so it never clobbers data written after migration. The
 * legacy localStorage entries are left in place as a passive backup.
 */
export async function migrateLocalStorageToVault(): Promise<void> {
  if (typeof indexedDB === "undefined" || typeof localStorage === "undefined") return;
  if (localStorage.getItem(MIGRATION_FLAG) === "1") return;

  try {
    await db.transaction("rw", db.dumps, db.keys, db.cards, db.assets, async () => {
      if ((await db.dumps.count()) === 0) {
        const dumps = readJson<LegacyDump[]>(LEGACY.dumps, []);
        const meta = readJson<StoredDumpMeta[]>(LEGACY.dumpMeta, []);
        const metaById = new Map(meta.map((entry) => [entry.dumpId, entry]));
        const records: DumpRecord[] = dumps.map((dump) => {
          const dumpMeta = metaById.get(dump.id);
          return {
            id: dump.id,
            name: dump.name,
            data: dump.data,
            uid: normalizeUid(dump.data?.Card?.UID),
            cachedAt: dump.cachedAt ?? Date.now(),
            favorite: dumpMeta?.favorite ?? false,
            notes: dumpMeta?.notes ?? "",
            updatedAt: dumpMeta?.updatedAt ?? dump.cachedAt ?? Date.now(),
          };
        });
        if (records.length) await db.dumps.bulkPut(records);
      }

      if ((await db.keys.count()) === 0) {
        const keys = readJson<StoredKey[]>(LEGACY.keys, []);
        if (keys.length) await db.keys.bulkPut(keys);
      }

      if ((await db.cards.count()) === 0) {
        const cards = readJson<StoredCard[]>(LEGACY.cards, []);
        if (cards.length) await db.cards.bulkPut(cards);
      }

      if ((await db.assets.count()) === 0) {
        const assets = readJson<LegacyAsset[]>(LEGACY.assets, []);
        const records: AssetRecord[] = assets
          .filter((asset) => Boolean(asset.base64))
          .map((asset) => ({
            id: asset.id,
            name: asset.name,
            relativePath: asset.relativePath,
            kind: asset.kind,
            size: asset.size,
            base64: asset.base64 as string,
            updatedAt: asset.updatedAt ?? Date.now(),
          }));
        if (records.length) await db.assets.bulkPut(records);
      }
    });

    localStorage.setItem(MIGRATION_FLAG, "1");
  } catch (error) {
    // Leave the flag unset so migration is retried on the next load.
    console.error("Vault migration failed", error);
  }
}
