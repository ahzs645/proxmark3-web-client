import type { BlockAccess, TrailerAccess } from "./types";

export const DATA_BLOCK_ACCESS: BlockAccess[] = [
  { read: "A|B", write: "A|B", increment: "A|B", decrement: "A|B" },
  { read: "A|B", write: "never", increment: "never", decrement: "A|B" },
  { read: "A|B", write: "never", increment: "never", decrement: "never" },
  { read: "B", write: "B", increment: "never", decrement: "never" },
  { read: "A|B", write: "B", increment: "never", decrement: "never" },
  { read: "B", write: "never", increment: "never", decrement: "never" },
  { read: "A|B", write: "B", increment: "B", decrement: "A|B" },
  { read: "never", write: "never", increment: "never", decrement: "never" },
];

export const TRAILER_ACCESS: TrailerAccess[] = [
  {
    keyARead: "never",
    keyAWrite: "A",
    accessBitsRead: "A",
    accessBitsWrite: "never",
    keyBRead: "A",
    keyBWrite: "A",
  },
  {
    keyARead: "never",
    keyAWrite: "A",
    accessBitsRead: "A",
    accessBitsWrite: "A",
    keyBRead: "A",
    keyBWrite: "A",
  },
  {
    keyARead: "never",
    keyAWrite: "never",
    accessBitsRead: "A",
    accessBitsWrite: "never",
    keyBRead: "A",
    keyBWrite: "never",
  },
  {
    keyARead: "never",
    keyAWrite: "B",
    accessBitsRead: "A|B",
    accessBitsWrite: "B",
    keyBRead: "never",
    keyBWrite: "B",
  },
  {
    keyARead: "never",
    keyAWrite: "B",
    accessBitsRead: "A|B",
    accessBitsWrite: "never",
    keyBRead: "never",
    keyBWrite: "B",
  },
  {
    keyARead: "never",
    keyAWrite: "never",
    accessBitsRead: "A|B",
    accessBitsWrite: "B",
    keyBRead: "never",
    keyBWrite: "never",
  },
  {
    keyARead: "never",
    keyAWrite: "never",
    accessBitsRead: "A|B",
    accessBitsWrite: "never",
    keyBRead: "never",
    keyBWrite: "never",
  },
  {
    keyARead: "never",
    keyAWrite: "never",
    accessBitsRead: "A|B",
    accessBitsWrite: "never",
    keyBRead: "never",
    keyBWrite: "never",
  },
];
