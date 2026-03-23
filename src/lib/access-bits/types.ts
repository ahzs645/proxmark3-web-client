export type Permission = "A" | "B" | "A|B" | "never";

export interface BlockAccess {
  read: Permission;
  write: Permission;
  increment: Permission;
  decrement: Permission; // Also includes transfer and restore
}

export interface TrailerAccess {
  keyARead: Permission;
  keyAWrite: Permission;
  accessBitsRead: Permission;
  accessBitsWrite: Permission;
  keyBRead: Permission;
  keyBWrite: Permission;
}

export interface SectorAccess {
  block0: BlockAccess;
  block1: BlockAccess;
  block2: BlockAccess;
  trailer: TrailerAccess;
}

export interface AccessBitsResult {
  valid: boolean;
  error?: string;
  c0: number; // 0-7, access condition for block 0
  c1: number; // 0-7, access condition for block 1
  c2: number; // 0-7, access condition for block 2
  c3: number; // 0-7, access condition for trailer
  sectorAccess: SectorAccess;
}
