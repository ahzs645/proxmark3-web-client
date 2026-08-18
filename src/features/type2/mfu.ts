import type { PM3DumpJson } from "@/features/memory/types";
import { genericProfileFromCc, profileFromMaxPage, type Type2Profile } from "./profiles";
import { extractNdefTlv } from "./tlv";

export interface ParsedMfuDump {
  header: Uint8Array;
  pages: Uint8Array;
  maxPage: number;
  uid: Uint8Array;
  staticLock: Uint8Array;
  dynamicLock?: Uint8Array;
  auth0?: number;
  capabilityContainer: Uint8Array;
  ndefMessage?: Uint8Array;
  profile?: Type2Profile;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^a-fA-F0-9]/g, "");
  if (clean.length % 2) throw new Error("Odd-length hexadecimal data.");
  return new Uint8Array(clean.match(/../g)?.map((value) => Number.parseInt(value, 16)) ?? []);
}

export function parseMfuBytes(data: Uint8Array): ParsedMfuDump {
  if (data.length < 72) throw new Error("MFU dump is too short.");
  const maxPage = data[11];
  const expected = 56 + (maxPage + 1) * 4;
  if (data.length !== expected)
    throw new Error(`MFU dump size ${data.length} does not match max page ${maxPage}.`);
  const header = data.slice(0, 56);
  const pages = data.slice(56);
  const uid = new Uint8Array([...pages.slice(0, 3), ...pages.slice(4, 8)]);
  const staticLock = pages.slice(10, 12);
  const capabilityContainer = pages.slice(12, 16);
  const profile = profileFromMaxPage(maxPage) ?? genericProfileFromCc(capabilityContainer, maxPage);
  let dynamicLock: Uint8Array | undefined;
  let auth0: number | undefined;
  if (profile?.dynamicLockPage !== undefined && profile.configPage !== undefined) {
    dynamicLock = pages.slice(profile.dynamicLockPage * 4, profile.dynamicLockPage * 4 + 3);
    auth0 = pages[profile.configPage * 4 + 3];
  }
  const capacity = [0xe1, 0xf1].includes(capabilityContainer[0]) ? capabilityContainer[2] * 8 : 0;
  const userArea = pages.slice(16, 16 + capacity);
  return {
    header,
    pages,
    maxPage,
    uid,
    staticLock,
    dynamicLock,
    auth0,
    capabilityContainer,
    ndefMessage: userArea.length ? extractNdefTlv(userArea) : undefined,
    profile,
  };
}

export function parseMfuJson(dump: PM3DumpJson): ParsedMfuDump {
  const rows = Object.entries(dump.blocks ?? {}).sort(([a], [b]) => Number(a) - Number(b));
  const pages = new Uint8Array(rows.flatMap(([, value]) => Array.from(hexToBytes(value))));
  const header = dump.MfuHeader ? hexToBytes(dump.MfuHeader) : new Uint8Array(56);
  if (!dump.MfuHeader) header[11] = Math.max(0, rows.length - 1);
  return parseMfuBytes(new Uint8Array([...header, ...pages]));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
