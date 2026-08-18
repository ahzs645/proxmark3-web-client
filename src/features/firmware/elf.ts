import type { ElfSegment } from "./types";

const ELF_MAGIC = [0x7f, 0x45, 0x4c, 0x46];
const ELF_CLASS_32 = 1;
const ELF_LITTLE_ENDIAN = 1;
const PT_LOAD = 1;
const FLASH_START = 0x100000;
const FLASH_END = 0x17ffff;
const ELF_HEADER_SIZE = 52;

/** Parse only loadable SAM7 flash segments from a 32-bit little-endian ELF. */
export function parseFirmwareElf(buffer: ArrayBuffer): ElfSegment[] {
  if (buffer.byteLength < ELF_HEADER_SIZE) {
    throw new Error("File is too small to be a valid ELF binary");
  }

  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  for (let index = 0; index < ELF_MAGIC.length; index++) {
    if (bytes[index] !== ELF_MAGIC[index]) throw new Error("Invalid ELF magic number");
  }
  if (bytes[4] !== ELF_CLASS_32) throw new Error("Firmware must be a 32-bit ELF binary");
  if (bytes[5] !== ELF_LITTLE_ENDIAN) {
    throw new Error("Firmware ELF must use little-endian encoding");
  }

  const headerOffset = view.getUint32(28, true);
  const headerEntrySize = view.getUint16(42, true);
  const headerCount = view.getUint16(44, true);
  if (headerOffset + headerEntrySize * headerCount > buffer.byteLength) {
    throw new Error("ELF program header table extends beyond the file");
  }

  const segments: ElfSegment[] = [];
  for (let index = 0; index < headerCount; index++) {
    const offset = headerOffset + index * headerEntrySize;
    const type = view.getUint32(offset, true);
    const fileOffset = view.getUint32(offset + 4, true);
    const address = view.getUint32(offset + 12, true);
    const size = view.getUint32(offset + 16, true);
    if (type !== PT_LOAD || size === 0) continue;
    if (address < FLASH_START || address > FLASH_END || address + size - 1 > FLASH_END) continue;
    if (fileOffset + size > buffer.byteLength) {
      throw new Error(`ELF segment at 0x${address.toString(16)} extends beyond the file`);
    }
    segments.push({ address, data: new Uint8Array(buffer.slice(fileOffset, fileOffset + size)) });
  }

  return segments;
}

export const FIRMWARE_FLASH_RANGE = { start: FLASH_START, end: FLASH_END } as const;
