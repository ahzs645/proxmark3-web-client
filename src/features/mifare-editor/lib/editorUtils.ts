import type { CachedAsset } from "@/components/panels/KeyCachePanel";
import type { BlockRow, KeyType, TrailerPreset } from "../types";

export const DEMO_ROWS: BlockRow[] = [
  { sector: 0, block: 0, data: "3D06CCC2E5884400E29346321A2761D9" },
  { sector: 0, block: 1, data: "00000000000000000000000000000000" },
  { sector: 0, block: 2, data: "1B5EA82A9555FF07BB67C33BAA3572FB" },
  { sector: 0, block: 3, data: "A0A1A2A3A4A586878688FFFF078069FF" },
  { sector: 1, block: 4, data: "00000000000000000000000000000000" },
  { sector: 1, block: 5, data: "156AAAD3A55FFF07BB69A2E35F7E7EB7" },
  { sector: 1, block: 6, data: "00000000000000000000000000000000" },
  { sector: 1, block: 7, data: "FF078069FFFF00000000000000000000" },
  { sector: 2, block: 8, data: "00000000000000000000000000000000" },
  { sector: 2, block: 9, data: "29FF1DA53355FF07BB69A2E35F7E7EB7" },
  { sector: 2, block: 10, data: "00000000000000000000000000000000" },
  { sector: 2, block: 11, data: "FF078069FFFF00000000000000000000" },
];

export const TRAILER_PRESETS: TrailerPreset[] = [
  { label: "Transport", keyA: "FFFFFFFFFFFF", keyB: "FFFFFFFFFFFF", access: "FF0780", gpb: "69" },
  {
    label: "KeyB Protected",
    keyA: "FFFFFFFFFFFF",
    keyB: "FFFFFFFFFFFF",
    access: "7F0788",
    gpb: "69",
  },
  { label: "Read-Only", keyA: "FFFFFFFFFFFF", keyB: "FFFFFFFFFFFF", access: "078F00", gpb: "69" },
];

export function isTrailerBlock(block: number) {
  return block % 4 === 3;
}

export function isManufacturerBlock(block: number) {
  return block === 0;
}

export function sanitizeHex(value: string, maxLength: number) {
  return value
    .toUpperCase()
    .replace(/[^A-F0-9]/gi, "")
    .slice(0, maxLength);
}

export function sanitizeBlockNumber(value: string) {
  return value.replace(/\D/g, "");
}

export function hexToAscii(hex: string) {
  const clean = hex.replace(/\s/g, "");
  let result = "";
  for (let i = 0; i < clean.length; i += 2) {
    const byte = Number.parseInt(clean.slice(i, i + 2), 16);
    result += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".";
  }
  return result;
}

export function sanitizeBlockData(value: string) {
  return sanitizeHex(value, 32);
}

export function buildReadBlockCommand(block: number, keyType: KeyType, key: string) {
  return `hf mf rdbl ${block} ${keyType.toLowerCase()} ${key}`;
}

export function buildWriteBlockCommand(block: number, keyType: KeyType, key: string, data: string) {
  return `hf mf wrbl ${block} ${keyType.toLowerCase()} ${key} ${data}`;
}

export function resolveCachePath(item: CachedAsset, cachePathPrefix: string) {
  return `${cachePathPrefix}/${item.relativePath || item.name}`;
}

export function buildTrailerPreview(keyA: string, keyB: string, access: string, gpb: string) {
  const paddedA = sanitizeHex(keyA, 12).padEnd(12, "F");
  const paddedB = sanitizeHex(keyB, 12).padEnd(12, "F");
  const paddedAccess = sanitizeHex(access, 6).padEnd(6, "0");
  const paddedGpb = sanitizeHex(gpb, 2).padEnd(2, "0");
  return `${paddedA}${paddedAccess}${paddedGpb}${paddedB}`;
}

export function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}
