import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  type AssetRecord,
  type BackupRecord,
  type CardRecord,
  type DumpRecord,
  type KeyRecord,
  type LfCardRecord,
  type OperationRecord,
  type VirtualCardMemberRecord,
  type VirtualCardRecord,
} from "./db";

// Shared empty arrays keep referential identity stable while a live query is
// still resolving (useLiveQuery returns undefined on the first render).
const EMPTY_DUMPS: DumpRecord[] = [];
const EMPTY_KEYS: KeyRecord[] = [];
const EMPTY_CARDS: CardRecord[] = [];
const EMPTY_ASSETS: AssetRecord[] = [];
const EMPTY_LF_CARDS: LfCardRecord[] = [];
const EMPTY_OPERATIONS: OperationRecord[] = [];
const EMPTY_BACKUPS: BackupRecord[] = [];
const EMPTY_VIRTUAL_CARDS: VirtualCardRecord[] = [];
const EMPTY_VIRTUAL_CARD_MEMBERS: VirtualCardMemberRecord[] = [];

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

/** Live list of saved LF credentials, newest first. */
export function useVaultLfCards(): LfCardRecord[] {
  return useLiveQuery(() => db.lfCards.orderBy("updatedAt").reverse().toArray()) ?? EMPTY_LF_CARDS;
}

/** Live operation audit trail, newest first. */
export function useVaultOperations(): OperationRecord[] {
  return (
    useLiveQuery(() => db.operations.orderBy("updatedAt").reverse().limit(100).toArray()) ??
    EMPTY_OPERATIONS
  );
}

export function useVaultBackups(): BackupRecord[] {
  return useLiveQuery(() => db.backups.orderBy("createdAt").reverse().toArray()) ?? EMPTY_BACKUPS;
}

/** Live list of virtual cards (the user-named physical credentials). */
export function useVirtualCards(): VirtualCardRecord[] {
  return useLiveQuery(() => db.virtualCards.toArray()) ?? EMPTY_VIRTUAL_CARDS;
}

/** Live list of every virtual-card membership edge. */
export function useVirtualCardMembers(): VirtualCardMemberRecord[] {
  return useLiveQuery(() => db.virtualCardMembers.toArray()) ?? EMPTY_VIRTUAL_CARD_MEMBERS;
}
