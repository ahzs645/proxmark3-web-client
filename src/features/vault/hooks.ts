import { useLiveQuery } from "dexie-react-hooks";
import { db, type AssetRecord, type CardRecord, type DumpRecord, type KeyRecord } from "./db";

// Shared empty arrays keep referential identity stable while a live query is
// still resolving (useLiveQuery returns undefined on the first render).
const EMPTY_DUMPS: DumpRecord[] = [];
const EMPTY_KEYS: KeyRecord[] = [];
const EMPTY_CARDS: CardRecord[] = [];
const EMPTY_ASSETS: AssetRecord[] = [];

/** Live list of cached dumps, newest first. */
export function useVaultDumps(): DumpRecord[] {
  return useLiveQuery(() => db.dumps.orderBy("cachedAt").reverse().toArray()) ?? EMPTY_DUMPS;
}

/** Live list of library keys. */
export function useVaultKeys(): KeyRecord[] {
  return useLiveQuery(() => db.keys.toArray()) ?? EMPTY_KEYS;
}

/** Live list of library cards. */
export function useVaultCards(): CardRecord[] {
  return useLiveQuery(() => db.cards.toArray()) ?? EMPTY_CARDS;
}

/** Live list of cached files, newest first. */
export function useVaultAssets(): AssetRecord[] {
  return useLiveQuery(() => db.assets.orderBy("updatedAt").reverse().toArray()) ?? EMPTY_ASSETS;
}
