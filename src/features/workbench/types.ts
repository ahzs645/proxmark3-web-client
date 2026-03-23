import type { CachedAsset } from "@/components/panels/KeyCachePanel";

export type CachedAssetWithData = CachedAsset & { base64: string };

export type EmscriptenFSLike = {
  analyzePath?: (path: string) => { exists?: boolean };
  mkdir?: (path: string) => void;
  mkdirTree?: (path: string) => void;
  readFile?: (
    path: string,
    opts?: { encoding?: "binary" | "utf8"; flags?: string },
  ) => Uint8Array | string | number[];
  writeFile?: (path: string, data: Uint8Array, opts?: { flags?: string }) => void;
};
