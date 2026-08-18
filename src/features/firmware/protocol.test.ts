import { describe, expect, test } from "vite-plus/test";
import {
  decodeLegacyResponse,
  encodeLegacyCommand,
  encodeNgCommand,
  flashSegments,
  PM3_COMMAND,
  PM3_USB_PRODUCT_ID,
  PM3_USB_VENDOR_ID,
  type FirmwareIo,
} from "./protocol";

function legacyAck(command = PM3_COMMAND.ACK): Uint8Array {
  return encodeLegacyCommand(BigInt(command));
}

describe("firmware protocol", () => {
  test("uses the Proxmark3 USB identifiers exposed by Chrome", () => {
    expect(PM3_USB_VENDOR_ID).toBe(0x9ac4);
    expect(PM3_USB_PRODUCT_ID).toBe(0x4b8f);
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
});
