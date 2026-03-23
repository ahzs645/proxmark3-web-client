export type CardType = "classic-1k" | "classic-4k" | "ultralight";

export interface Block {
  index: number;
  sector: number;
  data: string;
  kind: "manufacturer" | "data" | "trailer" | "page";
  label: string;
  dirty?: boolean;
}

export interface PM3DumpJson {
  Created?: string;
  FileType?: string;
  Card?: {
    UID?: string;
    ATQA?: string;
    SAK?: string;
  };
  blocks?: Record<string, string>;
  SectorKeys?: Record<
    string,
    {
      KeyA?: string;
      KeyB?: string;
      AccessConditions?: string;
      AccessConditionsText?: Record<string, string>;
    }
  >;
}

export interface CachedDump {
  id: string;
  name: string;
  data: PM3DumpJson;
  cachedAt: number;
}

export interface TrailerInfo {
  keyA: string;
  accessBits: string;
  keyB: string;
}

export interface TrailerPreset {
  label: string;
  keyA: string;
  keyB: string;
  access: string;
  gpb: string;
}

export type SectorGroup = [number, Block[]];

export type SectorKeysRecord = NonNullable<PM3DumpJson["SectorKeys"]>;
