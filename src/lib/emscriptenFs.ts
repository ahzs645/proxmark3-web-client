import type { EmscriptenFSLike } from "@/features/workbench/types";

export function getEmscriptenFs(): EmscriptenFSLike | undefined {
  if (typeof window === "undefined") return undefined;
  const globalWindow = window as typeof window & {
    FS?: EmscriptenFSLike;
    Module?: { FS?: EmscriptenFSLike };
  };
  return globalWindow.FS ?? globalWindow.Module?.FS;
}

export function ensureFsDirectory(path: string): EmscriptenFSLike {
  const fs = getEmscriptenFs();
  if (!fs?.readFile || !fs.writeFile) throw new Error("The PM3 browser filesystem is unavailable.");
  if (!fs.analyzePath?.(path)?.exists) {
    if (fs.mkdirTree) fs.mkdirTree(path);
    else if (fs.mkdir) fs.mkdir(path);
  }
  return fs;
}

export function readFsBytes(path: string): Uint8Array {
  const fs = getEmscriptenFs();
  if (!fs?.readFile) throw new Error("The PM3 browser filesystem is unavailable.");
  const candidates = [path, `${path}.bin`];
  for (const candidate of candidates) {
    if (fs.analyzePath && !fs.analyzePath(candidate)?.exists) continue;
    try {
      const data = fs.readFile(candidate, { encoding: "binary" });
      if (data instanceof Uint8Array) return data;
      if (Array.isArray(data)) return Uint8Array.from(data);
      if (typeof data === "string")
        return Uint8Array.from(data, (character) => character.charCodeAt(0));
    } catch {
      // Try the generated .bin sidecar before failing.
    }
  }
  throw new Error("The PM3 command completed without producing the expected dump file.");
}
