import type { ElfSegment } from "./types";

const ELF_MAGIC = [0x7f, 0x45, 0x4c, 0x46];
const ELF_CLASS_32 = 1;
const ELF_LITTLE_ENDIAN = 1;
const PT_LOAD = 1;
const FLASH_START = 0x100000;
const FLASH_END = 0x17ffff;
const ELF_HEADER_SIZE = 52;

/** Loadable segments plus the version-information magic, chip-family agnostic. */
export interface ElfImage {
  segments: ElfSegment[];
  /** `.version_information` magic (PM3V/PM5V), or null if the section is absent. */
  magic: number | null;
}

function validateElfHeader(bytes: Uint8Array): void {
  if (bytes.length < ELF_HEADER_SIZE) throw new Error("File is too small to be a valid ELF binary");
  for (let index = 0; index < ELF_MAGIC.length; index++) {
    if (bytes[index] !== ELF_MAGIC[index]) throw new Error("Invalid ELF magic number");
  }
  if (bytes[4] !== ELF_CLASS_32) throw new Error("Firmware must be a 32-bit ELF binary");
  if (bytes[5] !== ELF_LITTLE_ENDIAN)
    throw new Error("Firmware ELF must use little-endian encoding");
}

/** All PT_LOAD segments, regardless of chip family (no flash-window filter). */
function readLoadSegments(buffer: ArrayBuffer): ElfSegment[] {
  const view = new DataView(buffer);
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
    if (fileOffset + size > buffer.byteLength) {
      throw new Error(`ELF segment at 0x${address.toString(16)} extends beyond the file`);
    }
    segments.push({ address, data: new Uint8Array(buffer.slice(fileOffset, fileOffset + size)) });
  }
  return segments;
}

/**
 * Read the `.version_information` magic (its first 32-bit field), located the
 * same way upstream `flash.c` does: via the section-header string table. The
 * magic identifies the chip family the image targets (PM3V vs PM5V) and is
 * forwarded to the bootrom's `FINISH_WRITE` compatibility check.
 */
function readVersionMagic(buffer: ArrayBuffer): number | null {
  const view = new DataView(buffer);
  const sectionOffset = view.getUint32(32, true);
  const sectionEntrySize = view.getUint16(46, true);
  const sectionCount = view.getUint16(48, true);
  const stringTableIndex = view.getUint16(50, true);
  if (sectionOffset === 0 || sectionCount === 0) return null;
  if (sectionOffset + sectionEntrySize * sectionCount > buffer.byteLength) return null;
  if (stringTableIndex >= sectionCount) return null;

  const bytes = new Uint8Array(buffer);
  const stringTableHeader = sectionOffset + stringTableIndex * sectionEntrySize;
  const stringTableOffset = view.getUint32(stringTableHeader + 16, true);

  const readName = (nameOffset: number): string => {
    let end = stringTableOffset + nameOffset;
    while (end < bytes.length && bytes[end] !== 0) end++;
    return new TextDecoder().decode(bytes.slice(stringTableOffset + nameOffset, end));
  };

  for (let index = 0; index < sectionCount; index++) {
    const header = sectionOffset + index * sectionEntrySize;
    const name = readName(view.getUint32(header, true));
    const sectionAddress = view.getUint32(header + 12, true);
    const dataOffset = view.getUint32(header + 16, true);
    const sectionSize = view.getUint32(header + 20, true);
    if (name === ".version_information") {
      if (dataOffset + 4 > buffer.byteLength) return null;
      return view.getUint32(dataOffset, true);
    }
    // A bootrom has no such section: the last word of `.bootphase1` holds the
    // address of its version information inside that same section.
    if (name === ".bootphase1") {
      if (sectionSize < 4 || dataOffset + sectionSize > buffer.byteLength) return null;
      const pointer = view.getUint32(dataOffset + sectionSize - 4, true);
      if (pointer < sectionAddress) return null;
      const offset = pointer - sectionAddress;
      if (offset + 4 > sectionSize) return null;
      return view.getUint32(dataOffset + offset, true);
    }
  }
  return null;
}

/**
 * Parse a firmware ELF for any Proxmark chip family: every loadable segment
 * plus the version-information magic. Callers pick the segments relevant to the
 * connected board's flash window (see {@link flashGeometry}).
 */
export function parseElfImage(buffer: ArrayBuffer): ElfImage {
  validateElfHeader(new Uint8Array(buffer));
  return { segments: readLoadSegments(buffer), magic: readVersionMagic(buffer) };
}

/** Parse only loadable SAM7 flash segments from a 32-bit little-endian ELF. */
export function parseFirmwareElf(buffer: ArrayBuffer): ElfSegment[] {
  validateElfHeader(new Uint8Array(buffer));
  return readLoadSegments(buffer).filter(
    (segment) =>
      segment.address >= FLASH_START &&
      segment.address <= FLASH_END &&
      segment.address + segment.data.length - 1 <= FLASH_END,
  );
}

export const FIRMWARE_FLASH_RANGE = { start: FLASH_START, end: FLASH_END } as const;
