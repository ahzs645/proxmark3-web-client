import type { ElfSegment, FirmwareProgress, ReaderInspection } from "./types";

export const PM3_USB_VENDOR_ID = 0x9ac4;
export const PM3_USB_PRODUCT_ID = 0x4b8f;

const NG_COMMAND_MAGIC = 0x61334d50;
const NG_RESPONSE_MAGIC = 0x62334d50;
const NG_POSTAMBLE_MAGIC = 0x3361;
const LEGACY_PACKET_SIZE = 544;
const FLASH_BLOCK_SIZE = 512;
const BOOTLOADER_END = 0x102000;
const BOOTLOADER_UNLOCK_MAGIC = 0x54494f44;
const BOOTLOADER_FLAG = 4n;
const ICEMAN_BOOTLOADER_FLAG = 64n;

export const PM3_COMMAND = {
  DEVICE_INFO: 0,
  FINISH_WRITE: 3,
  HARDWARE_RESET: 4,
  START_FLASH: 5,
  CHIP_INFO: 6,
  BL_VERSION: 7,
  VERSION: 263,
  CAPABILITIES: 274,
  DEBUG_PRINT_STRING: 256,
  ACK: 255,
  NACK: 254,
} as const;

export interface Pm3Response {
  cmd: number;
  status: number;
  data: Uint8Array;
}

export interface LegacyResponse {
  cmd: bigint;
  arg0: bigint;
  arg1: bigint;
  arg2: bigint;
  data: Uint8Array;
}

export interface FirmwareIo {
  write(data: Uint8Array): Promise<void>;
  readChunk(timeoutMs: number): Promise<Uint8Array>;
}

export interface BootloaderInfo {
  inBootloader: boolean;
  bootloaderType: "legacy" | "iceman" | "unknown";
  chipId: number | null;
}

export function encodeNgCommand(
  command: number,
  payload: Uint8Array = new Uint8Array(),
): Uint8Array {
  if (payload.length > 512) throw new RangeError("PM3 command payload exceeds 512 bytes");
  const packet = new Uint8Array(10 + payload.length);
  const view = new DataView(packet.buffer);
  view.setUint32(0, NG_COMMAND_MAGIC, true);
  view.setUint16(4, 0x8000 | payload.length, true);
  view.setUint16(6, command, true);
  packet.set(payload, 8);
  view.setUint16(8 + payload.length, NG_POSTAMBLE_MAGIC, true);
  return packet;
}

export function encodeLegacyCommand(
  command: bigint,
  arg0 = 0n,
  arg1 = 0n,
  arg2 = 0n,
  payload: Uint8Array = new Uint8Array(),
): Uint8Array {
  const packet = new Uint8Array(LEGACY_PACKET_SIZE);
  const view = new DataView(packet.buffer);
  view.setBigUint64(0, command, true);
  view.setBigUint64(8, arg0, true);
  view.setBigUint64(16, arg1, true);
  view.setBigUint64(24, arg2, true);
  packet.set(payload.subarray(0, 512), 32);
  return packet;
}

export function decodeLegacyResponse(packet: Uint8Array): LegacyResponse {
  if (packet.length !== LEGACY_PACKET_SIZE) throw new Error("Incomplete bootloader response");
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  return {
    cmd: view.getBigUint64(0, true),
    arg0: view.getBigUint64(8, true),
    arg1: view.getBigUint64(16, true),
    arg2: view.getBigUint64(24, true),
    data: packet.slice(32),
  };
}

async function readBytes(io: FirmwareIo, minimum: number, timeoutMs: number): Promise<Uint8Array> {
  const deadline = performance.now() + timeoutMs;
  let buffer = new Uint8Array();
  while (buffer.length < minimum) {
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw new Error(`Timed out after ${timeoutMs} ms`);
    const chunk = await io.readChunk(remaining);
    const combined = new Uint8Array(buffer.length + chunk.length);
    combined.set(buffer);
    combined.set(chunk, buffer.length);
    buffer = combined;
  }
  return buffer;
}

export async function sendLegacyCommand(
  io: FirmwareIo,
  command: number,
  arg0 = 0,
  arg1 = 0,
  arg2 = 0,
  payload: Uint8Array = new Uint8Array(),
  timeoutMs = 10_000,
): Promise<LegacyResponse> {
  await io.write(
    encodeLegacyCommand(BigInt(command), BigInt(arg0), BigInt(arg1), BigInt(arg2), payload),
  );
  const packet = await readBytes(io, LEGACY_PACKET_SIZE, timeoutMs);
  return decodeLegacyResponse(packet.slice(0, LEGACY_PACKET_SIZE));
}

function decodeNgPacket(packet: Uint8Array): Pm3Response {
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  const packedLength = view.getUint16(4, true);
  const length = packedLength & 0x7fff;
  return {
    cmd: view.getUint16(8, true),
    status: view.getUint8(6),
    data: packet.slice(10, 10 + length),
  };
}

export async function sendNgCommand(
  io: FirmwareIo,
  command: number,
  payload: Uint8Array = new Uint8Array(),
  timeoutMs = 5_000,
): Promise<Pm3Response> {
  await io.write(encodeNgCommand(command, payload));
  const deadline = performance.now() + timeoutMs;
  let buffer = new Uint8Array();

  while (performance.now() < deadline) {
    const chunk = await io.readChunk(Math.max(1, deadline - performance.now()));
    const combined = new Uint8Array(buffer.length + chunk.length);
    combined.set(buffer);
    combined.set(chunk, buffer.length);
    buffer = combined;

    while (buffer.length >= 6) {
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      if (view.getUint32(0, true) === NG_RESPONSE_MAGIC) {
        const frameLength = 12 + (view.getUint16(4, true) & 0x7fff);
        if (buffer.length < frameLength) break;
        const response = decodeNgPacket(buffer.slice(0, frameLength));
        buffer = buffer.slice(frameLength);
        if (response.cmd === command || response.cmd === PM3_COMMAND.ACK) return response;
        if (response.cmd === PM3_COMMAND.NACK) {
          throw new Error(`Reader rejected command 0x${command.toString(16)}`);
        }
        continue;
      }

      if (buffer.length >= LEGACY_PACKET_SIZE) {
        const legacy = decodeLegacyResponse(buffer.slice(0, LEGACY_PACKET_SIZE));
        buffer = buffer.slice(LEGACY_PACKET_SIZE);
        const responseCommand = Number(legacy.cmd & 0xffffn);
        if (responseCommand === command || responseCommand === PM3_COMMAND.ACK) {
          return { cmd: responseCommand, status: 0, data: legacy.data };
        }
        continue;
      }

      break;
    }
  }

  throw new Error(`Command 0x${command.toString(16)} timed out after ${timeoutMs} ms`);
}

function parseVersionPart(value: string) {
  const version = value.match(/v(\d+\.\d+(?:\.\d+)?)/)?.[1] ?? "";
  const buildDate = value.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
  const gitHash = value.match(/\b(g?[0-9a-f]{7,9})\b/i)?.[1] ?? "";
  return { version, buildDate, gitHash };
}

function parseVersionResponse(data: Uint8Array) {
  let chipId = 0;
  let text = "";
  if (data.byteLength >= 12) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    chipId = view.getUint32(0, true);
    const stringLength = view.getUint32(8, true);
    text = new TextDecoder().decode(data.slice(12, Math.min(12 + stringLength, data.length)));
  } else {
    text = new TextDecoder().decode(data);
  }
  const ansiEscape = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
  text = text.split(String.fromCharCode(0)).join("").replace(ansiEscape, "").trim();
  const bootromLine = text.match(/bootrom[.:]+\s*(.+?)(?:\n|$)/i)?.[1] ?? "";
  const firmwareLine = text.match(/os[.:]+\s*(.+?)(?:\n|$)/i)?.[1] ?? text;
  return {
    chipId,
    raw: text,
    bootrom: parseVersionPart(bootromLine),
    firmware: parseVersionPart(firmwareLine),
  };
}

function parseCapabilities(data: Uint8Array) {
  if (data.byteLength < 13) throw new Error("Capabilities response is incomplete");
  let flags = 0;
  for (let index = 0; index < 4; index++) flags |= data[9 + index] << (index * 8);
  const has = (bit: number) => ((flags >>> bit) & 1) === 1;
  return { hardwareFlash: has(23), hardwareSmartcard: has(24), isRdv4: has(25) };
}

function flashSizeKb(chipId: number): number {
  const sizeCode = (chipId >> 8) & 0x0f;
  return sizeCode === 9 ? 256 : sizeCode === 10 ? 512 : 0;
}

export async function inspectReader(io: FirmwareIo): Promise<ReaderInspection> {
  let bootloader: BootloaderInfo = {
    inBootloader: false,
    bootloaderType: "unknown",
    chipId: null,
  };
  try {
    bootloader = await inspectBootloader(io);
  } catch {
    // OS firmware does not always answer the legacy DEVICE_INFO probe cleanly.
  }
  if (bootloader.inBootloader) {
    const chipFlashKB = bootloader.chipId ? flashSizeKb(bootloader.chipId) : 0;
    return {
      mode: "bootloader",
      platform: chipFlashKB === 512 ? "PM3GENERIC" : "unknown",
      chipFlashKB,
      bootloaderType: bootloader.bootloaderType,
      bootrom: null,
      firmware: null,
      rawVersion: "",
    };
  }

  const versionResponse = await sendNgCommand(io, PM3_COMMAND.VERSION, new Uint8Array(), 4_000);
  if (versionResponse.status !== 0) throw new Error("Reader version query failed");
  const version = parseVersionResponse(versionResponse.data);
  let platform: ReaderInspection["platform"] = "unknown";
  try {
    const response = await sendNgCommand(io, PM3_COMMAND.CAPABILITIES, new Uint8Array(), 4_000);
    const capabilities = parseCapabilities(response.data);
    if (capabilities.hardwareFlash && capabilities.hardwareSmartcard) platform = "PM3RDV4";
    else if (!capabilities.hardwareFlash && !capabilities.hardwareSmartcard) {
      if (capabilities.isRdv4 || flashSizeKb(version.chipId) === 512) platform = "PM3GENERIC";
    }
  } catch {
    if (flashSizeKb(version.chipId) === 512) platform = "PM3GENERIC";
  }

  return {
    mode: "firmware",
    platform,
    chipFlashKB: flashSizeKb(version.chipId),
    bootloaderType: "unknown",
    bootrom: version.bootrom,
    firmware: version.firmware,
    rawVersion: version.raw,
  };
}

export async function inspectBootloader(io: FirmwareIo): Promise<BootloaderInfo> {
  const response = await sendLegacyCommand(
    io,
    PM3_COMMAND.DEVICE_INFO,
    0,
    0,
    0,
    new Uint8Array(),
    3_000,
  );
  const command = Number(response.cmd & 0xffffn);
  if (command === PM3_COMMAND.ACK || command === 255) {
    return { inBootloader: true, bootloaderType: "legacy", chipId: null };
  }
  if (command === PM3_COMMAND.DEBUG_PRINT_STRING || command === 256) {
    return { inBootloader: false, bootloaderType: "unknown", chipId: null };
  }
  const flags = response.arg0;
  const inBootloader = (flags & BOOTLOADER_FLAG) !== 0n;
  const bootloaderType =
    (flags & ICEMAN_BOOTLOADER_FLAG) === 0n ? ("legacy" as const) : ("iceman" as const);
  let chipId: number | null = null;
  if (inBootloader && bootloaderType === "iceman") {
    try {
      const chip = await sendLegacyCommand(
        io,
        PM3_COMMAND.CHIP_INFO,
        0,
        0,
        0,
        new Uint8Array(),
        3_000,
      );
      chipId = Number(chip.arg0);
    } catch {
      chipId = null;
    }
  }
  return { inBootloader, bootloaderType, chipId };
}

export async function enterBootloader(io: FirmwareIo): Promise<void> {
  await io.write(encodeNgCommand(PM3_COMMAND.START_FLASH));
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}

function blockifySegments(segments: ElfSegment[]): ElfSegment[] {
  if (segments.length === 0) return [];
  let first = Number.POSITIVE_INFINITY;
  let last = 0;
  for (const segment of segments) {
    if (segment.data.length === 0) continue;
    first = Math.min(first, segment.address);
    last = Math.max(last, segment.address + segment.data.length);
  }
  if (!Number.isFinite(first)) return [];
  const start = first & ~(FLASH_BLOCK_SIZE - 1);
  const length = ((last + FLASH_BLOCK_SIZE - 1) & ~(FLASH_BLOCK_SIZE - 1)) - start;
  const image = new Uint8Array(length);
  image.fill(0xff);
  for (const segment of segments) image.set(segment.data, segment.address - start);
  const blocks: ElfSegment[] = [];
  for (let offset = 0; offset < image.length; offset += FLASH_BLOCK_SIZE) {
    blocks.push({ address: start + offset, data: image.slice(offset, offset + FLASH_BLOCK_SIZE) });
  }
  return blocks;
}

export async function flashSegments(
  io: FirmwareIo,
  segments: ElfSegment[],
  phase: "flashing_bootrom" | "flashing_fullimage",
  onProgress: (progress: FirmwareProgress) => void,
): Promise<void> {
  const blocks = blockifySegments(segments);
  if (blocks.length === 0) return;
  const start = blocks[0].address;
  const end = blocks[blocks.length - 1].address + FLASH_BLOCK_SIZE;
  const unlock = start < BOOTLOADER_END ? BOOTLOADER_UNLOCK_MAGIC : 0;
  const boundary = await sendLegacyCommand(
    io,
    PM3_COMMAND.START_FLASH,
    start,
    end,
    unlock,
    new Uint8Array(),
    10_000,
  );
  if (Number(boundary.cmd & 0xffffn) === PM3_COMMAND.NACK) {
    throw new Error(
      `Bootloader rejected flash range 0x${start.toString(16)}–0x${end.toString(16)}`,
    );
  }

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    const response = await sendLegacyCommand(
      io,
      PM3_COMMAND.FINISH_WRITE,
      block.address,
      0,
      0,
      block.data,
      10_000,
    );
    if (Number(response.cmd & 0xffffn) === PM3_COMMAND.NACK) {
      throw new Error(`Flash write failed at 0x${block.address.toString(16)}`);
    }
    const percent = Math.round(((index + 1) / blocks.length) * 100);
    onProgress({
      phase,
      percent,
      message: `Writing block ${index + 1}/${blocks.length} at 0x${block.address.toString(16)}`,
    });
  }
}

export async function eraseFirmwareEntryPoint(io: FirmwareIo): Promise<void> {
  await flashSegments(
    io,
    [{ address: BOOTLOADER_END, data: new Uint8Array(FLASH_BLOCK_SIZE).fill(0xff) }],
    "flashing_fullimage",
    () => undefined,
  );
}

export async function resetReader(io: FirmwareIo): Promise<void> {
  await io.write(encodeLegacyCommand(BigInt(PM3_COMMAND.HARDWARE_RESET)));
  await new Promise((resolve) => setTimeout(resolve, 100));
}
