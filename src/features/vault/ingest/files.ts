import type { IngestFile } from "./types";

/**
 * Reading dropped files. A dropped *folder* only exposes its contents through
 * the non-standard `webkitGetAsEntry` API, so both that and the plain file list
 * are handled here and flattened into one shape the planner can consume.
 */

/** Minimal shape of the entry API; it is not in lib.dom's standard types. */
interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  fullPath: string;
  file?: (onSuccess: (file: File) => void, onError: (error: unknown) => void) => void;
  createReader?: () => {
    readEntries: (
      onSuccess: (entries: FileSystemEntryLike[]) => void,
      onError: (error: unknown) => void,
    ) => void;
  };
}

const MAX_FILES = 500;

async function readFile(file: File, path: string): Promise<IngestFile> {
  return {
    name: file.name,
    path: path || file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  };
}

function entryFile(entry: FileSystemEntryLike): Promise<File | null> {
  return new Promise((resolve) => {
    if (!entry.file) {
      resolve(null);
      return;
    }
    entry.file(resolve, () => resolve(null));
  });
}

/** `readEntries` returns at most 100 entries per call and must be drained. */
async function readDirectory(entry: FileSystemEntryLike): Promise<FileSystemEntryLike[]> {
  const reader = entry.createReader?.();
  if (!reader) return [];

  const entries: FileSystemEntryLike[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntryLike[]>((resolve) => {
      reader.readEntries(resolve, () => resolve([]));
    });
    if (!batch.length) break;
    entries.push(...batch);
  }
  return entries;
}

async function walkEntry(entry: FileSystemEntryLike, collected: IngestFile[]): Promise<void> {
  if (collected.length >= MAX_FILES) return;

  if (entry.isFile) {
    const file = await entryFile(entry);
    // fullPath starts with "/"; drop it so paths read as folder/file.
    if (file) collected.push(await readFile(file, entry.fullPath.replace(/^\//, "")));
    return;
  }

  if (entry.isDirectory) {
    for (const child of await readDirectory(entry)) {
      await walkEntry(child, collected);
    }
  }
}

/**
 * Flatten a drop into readable files, descending into any dropped folders.
 * Returns an empty list when the drop carried nothing readable.
 */
export async function filesFromDataTransfer(transfer: DataTransfer): Promise<IngestFile[]> {
  const collected: IngestFile[] = [];
  const items = [...transfer.items].filter((item) => item.kind === "file");

  // getAsEntry must be called synchronously against the live item list, before
  // any await invalidates it — so the entries are captured up front.
  // lib.dom types the return as FileSystemEntry, which omits the reader APIs
  // this walk needs, so it is re-cast to the shape actually implemented.
  const entries = items
    .map((item) => item.webkitGetAsEntry?.() as unknown as FileSystemEntryLike | null)
    .filter((entry): entry is FileSystemEntryLike => entry !== null);

  if (entries.length) {
    for (const entry of entries) await walkEntry(entry, collected);
    if (collected.length) return collected;
  }

  // Browsers without the entry API still expose a flat file list, which may
  // carry folder-relative paths of its own.
  for (const file of [...transfer.files].slice(0, MAX_FILES)) {
    collected.push(await readFile(file, relativePathOf(file)));
  }
  return collected;
}

/** Folder-relative path a File carries, falling back to its bare name. */
function relativePathOf(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

/** Flatten an `<input type="file">` selection, keeping folder-relative paths. */
export async function filesFromInput(list: FileList): Promise<IngestFile[]> {
  const collected: IngestFile[] = [];
  for (const file of [...list].slice(0, MAX_FILES)) {
    collected.push(await readFile(file, relativePathOf(file)));
  }
  return collected;
}
