import { describe, expect, test } from "vite-plus/test";
import { VERSION_INFORMATION_MAGIC_PM5V } from "./flashDevice";
import {
  decodeLegacyResponse,
  encodeLegacyCommand,
  encodeNgCommand,
  eraseFirmwareEntryPoint,
  flashSegments,
  flashTargetFor,
  isAt32ChipId,
  isProxmarkUsbId,
  parseCapabilities,
  PM3_COMMAND,
  PM3_USB_PRODUCT_ID,
  PM3_USB_VENDOR_ID,
  PM5_USB_PRODUCT_ID,
  PM5_USB_VENDOR_ID,
  type FirmwareIo,
} from "./protocol";

function legacyAck(command = PM3_COMMAND.ACK): Uint8Array {
  return encodeLegacyCommand(BigInt(command));
}

function recordingIo(): { io: FirmwareIo; writes: ReturnType<typeof decodeLegacyResponse>[] } {
  const writes: ReturnType<typeof decodeLegacyResponse>[] = [];
  return {
    writes,
    io: {
      write: (packet) => {
        writes.push(decodeLegacyResponse(packet));
        return Promise.resolve();
      },
      readChunk: () => Promise.resolve(legacyAck()),
    },
  };
}

// Bootloader of the AT32F435RGT7 Proxmark5 (1 MB flash, 2K erase/write unit).
const PM5_BOOTLOADER = {
  inBootloader: true,
  bootloaderType: "iceman" as const,
  chipId: 0x70083347,
  chipFamily: "at32" as const,
};

describe("firmware protocol", () => {
  test("uses the Proxmark3 USB identifiers exposed by Chrome", () => {
    expect(PM3_USB_VENDOR_ID).toBe(0x9ac4);
    expect(PM3_USB_PRODUCT_ID).toBe(0x4b8f);
  });

  test("recognises the Proxmark5 USB identity alongside the Proxmark3", () => {
    expect(PM5_USB_VENDOR_ID).toBe(0x2d2d);
    expect(PM5_USB_PRODUCT_ID).toBe(0x504d);
    expect(isProxmarkUsbId(0x9ac4, 0x4b8f)).toBe(true);
    expect(isProxmarkUsbId(0x2d2d, 0x504d)).toBe(true);
    expect(isProxmarkUsbId(0x2d2d, 0x4b8f)).toBe(false);
    expect(isProxmarkUsbId(undefined, undefined)).toBe(false);
  });

  test("recognises Proxmark5 AT32 chip ids (observed on factory firmware)", () => {
    // Real Proxmark5 probe: AT32F435RGT7 running factory firmware (capabilities v6,
    // no is_pm5 bit, banner still says Iceman/master with a PM3 FPGA image name).
    expect(isAt32ChipId(0x70083347)).toBe(true);
    expect(isAt32ChipId(0x7008454f)).toBe(true);
    expect(isAt32ChipId(0x270b0a4e)).toBe(false); // AT91SAM7S512 (Proxmark3)
    expect(isAt32ChipId(0)).toBe(false);
  });

  test("decodes the is_pm5 capability bit from the upstream bitfield layout", () => {
    // version(1) + baudrate(4) + bigbuf(4) = 9 bytes, then a 32-bit flag word.
    const packet = new Uint8Array(13);
    const flags = (1 << 28) | (1 << 25);
    for (let index = 0; index < 4; index++) packet[9 + index] = (flags >>> (index * 8)) & 0xff;
    const capabilities = parseCapabilities(packet);
    expect(capabilities.isPm5).toBe(true);
    expect(capabilities.isRdv4).toBe(true);
    expect(capabilities.hardwareFlash).toBe(false);
    expect(() => parseCapabilities(new Uint8Array(8))).toThrow(/incomplete/);
  });

  test("encodes an NG command with the PM3 preamble and postamble", () => {
    const packet = encodeNgCommand(PM3_COMMAND.VERSION, Uint8Array.of(0xaa));
    const view = new DataView(packet.buffer);
    expect(view.getUint32(0, true)).toBe(0x61334d50);
    expect(view.getUint16(4, true)).toBe(0x8001);
    expect(view.getUint16(6, true)).toBe(PM3_COMMAND.VERSION);
    expect(packet[8]).toBe(0xaa);
    expect(view.getUint16(9, true)).toBe(0x3361);
  });

  test("round-trips legacy command fields", () => {
    const packet = encodeLegacyCommand(5n, 1n, 2n, 3n, Uint8Array.of(0xaa));
    const decoded = decodeLegacyResponse(packet);
    expect(decoded.cmd).toBe(5n);
    expect(decoded.arg0).toBe(1n);
    expect(decoded.arg1).toBe(2n);
    expect(decoded.arg2).toBe(3n);
    expect(decoded.data[0]).toBe(0xaa);
  });

  test("pads firmware to 512-byte writes and reports progress", async () => {
    const writes: Uint8Array[] = [];
    const replies = [legacyAck(), legacyAck()];
    const io: FirmwareIo = {
      write: (packet) => {
        writes.push(packet);
        return Promise.resolve();
      },
      readChunk: () => Promise.resolve(replies.shift() ?? legacyAck()),
    };
    const progress: number[] = [];

    await flashSegments(
      io,
      [{ address: 0x102000, data: Uint8Array.of(1, 2, 3) }],
      "flashing_fullimage",
      (next) => progress.push(next.percent),
    );

    expect(writes).toHaveLength(2);
    const boundary = decodeLegacyResponse(writes[0]);
    const block = decodeLegacyResponse(writes[1]);
    expect(boundary.cmd).toBe(BigInt(PM3_COMMAND.START_FLASH));
    expect(boundary.arg0).toBe(0x102000n);
    expect(boundary.arg1).toBe(0x102200n);
    expect(block.cmd).toBe(BigInt(PM3_COMMAND.FINISH_WRITE));
    expect(block.data.slice(0, 5)).toEqual(Uint8Array.of(1, 2, 3, 0xff, 0xff));
    expect(progress).toEqual([100]);
  });

  test("derives the Proxmark5 flash layout from its bootloader", () => {
    const target = flashTargetFor(PM5_BOOTLOADER, VERSION_INFORMATION_MAGIC_PM5V);
    expect(target.geometry).toEqual({
      family: "at32",
      flashStart: 0x08000000,
      flashEnd: 0x08100000,
      bootEnd: 0x08004000,
      blockSize: 0x800,
    });
    expect(target.magic).toBe(VERSION_INFORMATION_MAGIC_PM5V);
  });

  test("writes a Proxmark5 bootrom as 2K units of four tagged 512-byte packets", async () => {
    const { io, writes } = recordingIo();
    const target = flashTargetFor(PM5_BOOTLOADER, VERSION_INFORMATION_MAGIC_PM5V);

    await flashSegments(
      io,
      [{ address: 0x08000000, data: new Uint8Array(0x900).fill(0xaa) }],
      "flashing_bootrom",
      () => undefined,
      target,
    );

    const [boundary, ...packets] = writes;
    expect(boundary.cmd).toBe(BigInt(PM3_COMMAND.START_FLASH));
    expect(boundary.arg0).toBe(0x08000000n);
    expect(boundary.arg1).toBe(0x08001000n);
    expect(boundary.arg2).toBe(0x54494f44n); // bootloader unlock
    expect(packets).toHaveLength(8);
    expect(packets.map((packet) => [packet.arg0, packet.arg2])).toEqual([
      [0x08000000n, 0n],
      [0x08000000n, 512n],
      [0x08000000n, 1024n],
      [0x08000000n, 1536n],
      [0x08000800n, 0n],
      [0x08000800n, 512n],
      [0x08000800n, 1024n],
      [0x08000800n, 1536n],
    ]);
    expect(packets.every((packet) => packet.arg1 === BigInt(VERSION_INFORMATION_MAGIC_PM5V))).toBe(
      true,
    );
    // 0x900 bytes of data, then 0xff padding to the end of the second unit.
    expect(packets[4].data[0x100 - 1]).toBe(0xaa);
    expect(packets[4].data[0x100]).toBe(0xff);
  });

  test("blanks the Proxmark5 OS entry so the bootrom stays in flash mode", async () => {
    const { io, writes } = recordingIo();
    await eraseFirmwareEntryPoint(
      io,
      flashTargetFor(PM5_BOOTLOADER, VERSION_INFORMATION_MAGIC_PM5V),
    );
    expect(writes[0].arg0).toBe(0x08004000n);
    expect(writes[0].arg2).toBe(0n); // OS area: no unlock
    expect(writes.slice(1)).toHaveLength(4);
    expect(writes.slice(1).every((packet) => packet.data.every((byte) => byte === 0xff))).toBe(
      true,
    );
  });

  test("refuses a segment that runs past the reader's flash", async () => {
    const { io, writes } = recordingIo();
    await expect(
      flashSegments(
        io,
        [{ address: 0x080ff000, data: new Uint8Array(0x2000) }],
        "flashing_fullimage",
        () => undefined,
        flashTargetFor(PM5_BOOTLOADER, VERSION_INFORMATION_MAGIC_PM5V),
      ),
    ).rejects.toThrow(/does not fit/);
    expect(writes).toHaveLength(0);
  });
});
