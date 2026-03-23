export type CachedAssetKind = "keys" | "dump" | "script" | "raw";

export interface CachedAsset {
  id: string;
  name: string;
  relativePath?: string;
  kind: CachedAssetKind;
  size: number;
  updatedAt: number;
  base64?: string;
}
