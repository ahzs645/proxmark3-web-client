import type { TrailerInfo, TrailerPreset } from "@/features/memory/types";

export const TRAILER_PRESETS: TrailerPreset[] = [
  {
    label: "Transport",
    keyA: "FFFFFFFFFFFF",
    keyB: "FFFFFFFFFFFF",
    access: "FF0780",
    gpb: "69",
  },
  {
    label: "KeyB Protected",
    keyA: "FFFFFFFFFFFF",
    keyB: "FFFFFFFFFFFF",
    access: "7F0788",
    gpb: "69",
  },
  {
    label: "Read-Only",
    keyA: "FFFFFFFFFFFF",
    keyB: "FFFFFFFFFFFF",
    access: "078F00",
    gpb: "69",
  },
];

export function parseTrailer(data: string): TrailerInfo | null {
  const clean = data.replace(/\s/g, "");
  if (clean.length < 32) return null;

  return {
    keyA: clean.slice(0, 12),
    accessBits: clean.slice(12, 20),
    keyB: clean.slice(20, 32),
  };
}

export function hexToAscii(hex: string): string {
  const clean = hex.replace(/\s/g, "");
  let result = "";

  for (let index = 0; index < clean.length; index += 2) {
    const byte = Number.parseInt(clean.slice(index, index + 2), 16);
    result += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".";
  }

  return result;
}

export function sanitizeHexInput(value: string, maxLength: number) {
  return value
    .toUpperCase()
    .replace(/[^A-F0-9]/gi, "")
    .slice(0, maxLength);
}

export function buildTrailerPreview({
  keyA,
  keyB,
  access,
  gpb,
}: {
  keyA: string;
  keyB: string;
  access: string;
  gpb: string;
}) {
  const paddedA = keyA.padEnd(12, "F").slice(0, 12).toUpperCase();
  const paddedB = keyB.padEnd(12, "F").slice(0, 12).toUpperCase();
  const paddedAccess = access.padEnd(6, "0").slice(0, 6).toUpperCase();
  const paddedGpb = gpb.padEnd(2, "0").slice(0, 2).toUpperCase();

  return `${paddedA}${paddedAccess}${paddedGpb}${paddedB}`;
}
