export interface Type2Profile {
  id: "ntag213" | "ntag215" | "ntag216" | "type2-generic";
  name: string;
  vendor?: string;
  maxPage?: number;
  userFirstPage: number;
  userLastPage?: number;
  ndefCapacity: number;
  ndefFirstPage: number;
  dynamicLockPage?: number;
  configPage?: number;
  supportsOriginality: boolean;
  knownLayout: boolean;
}

export function ndefLastPage(profile: Type2Profile): number {
  return profile.ndefFirstPage + Math.ceil(profile.ndefCapacity / 4) - 1;
}

export const NTAG213: Type2Profile = {
  id: "ntag213",
  name: "NXP NTAG213",
  vendor: "NXP",
  maxPage: 44,
  userFirstPage: 4,
  userLastPage: 39,
  ndefCapacity: 144,
  ndefFirstPage: 4,
  dynamicLockPage: 40,
  configPage: 41,
  supportsOriginality: true,
  knownLayout: true,
};

export const NTAG215: Type2Profile = {
  id: "ntag215",
  name: "NXP NTAG215",
  vendor: "NXP",
  maxPage: 134,
  userFirstPage: 4,
  userLastPage: 129,
  ndefCapacity: 496,
  ndefFirstPage: 4,
  dynamicLockPage: 130,
  configPage: 131,
  supportsOriginality: true,
  knownLayout: true,
};

export const NTAG216: Type2Profile = {
  id: "ntag216",
  name: "NXP NTAG216",
  vendor: "NXP",
  maxPage: 230,
  userFirstPage: 4,
  userLastPage: 225,
  ndefCapacity: 872,
  ndefFirstPage: 4,
  dynamicLockPage: 226,
  configPage: 227,
  supportsOriginality: true,
  knownLayout: true,
};

export const KNOWN_TYPE2_PROFILES = [NTAG213, NTAG215, NTAG216] as const;

export function profileFromMaxPage(maxPage: number): Type2Profile | undefined {
  return KNOWN_TYPE2_PROFILES.find((profile) => profile.maxPage === maxPage);
}

export function profileFromText(text: string): Type2Profile | undefined {
  const normalized = text.toLowerCase().replace(/\s/g, "");
  return KNOWN_TYPE2_PROFILES.find((profile) => normalized.includes(profile.id));
}

export function genericProfileFromCc(cc: Uint8Array, maxPage?: number): Type2Profile | undefined {
  if (cc.length !== 4 || ![0xe1, 0xf1].includes(cc[0])) return undefined;
  let capacity = cc[2] * 8;
  if (capacity <= 0) return undefined;
  let userLastPage = 4 + Math.ceil(capacity / 4) - 1;
  if (maxPage !== undefined) {
    userLastPage = Math.min(userLastPage, maxPage);
    capacity = Math.max(0, (userLastPage - 4 + 1) * 4);
  }
  return {
    id: "type2-generic",
    name: "NFC Forum Type 2",
    maxPage,
    userFirstPage: 4,
    userLastPage,
    ndefCapacity: capacity,
    ndefFirstPage: 4,
    supportsOriginality: false,
    knownLayout: false,
  };
}
