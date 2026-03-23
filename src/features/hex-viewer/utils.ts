import { cn } from "@/lib/utils";
import type { ByteView } from "./types";

export function toByteView(hexString: string, bytesPerRow: number = 16): ByteView[] {
  const clean = hexString.replace(/[^a-fA-F0-9]/g, "");
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i += 2) {
    const byte = clean.slice(i, i + 2);
    if (byte.length === 2) {
      bytes.push(parseInt(byte, 16));
    }
  }

  const rows: ByteView[] = [];
  for (let i = 0; i < bytes.length; i += bytesPerRow) {
    rows.push({ offset: i, bytes: bytes.slice(i, i + bytesPerRow) });
  }

  return rows;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function getByteColor(byte: number): string {
  if (byte === 0x00) return "text-muted-foreground/50";
  if (byte === 0xff) return "text-rose-400";
  if (byte >= 0x20 && byte <= 0x7e) return "text-emerald-400";
  return "text-foreground";
}

export function getAsciiChar(byte: number): string {
  return byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".";
}

export function isPrintable(byte: number): boolean {
  return byte >= 0x20 && byte <= 0x7e;
}

export function getGridClass(viewMode: "16" | "32" | "8") {
  return cn(
    "grid bg-secondary/50 px-3 py-2 text-[10px] font-semibold sticky top-0 border-b",
    viewMode === "32"
      ? "grid-cols-[70px_1fr_260px]"
      : viewMode === "8"
        ? "grid-cols-[70px_1fr_80px]"
        : "grid-cols-[70px_1fr_160px]",
  );
}
