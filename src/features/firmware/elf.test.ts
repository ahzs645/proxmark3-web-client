import { describe, expect, test } from "vite-plus/test";
import { parseFirmwareElf } from "./elf";

function firmwareElf(address = 0x100000, data = Uint8Array.of(1, 2, 3, 4)): ArrayBuffer {
  const buffer = new ArrayBuffer(0x100 + data.length);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 1, 1]);
  view.setUint32(28, 52, true);
  view.setUint16(42, 32, true);
  view.setUint16(44, 1, true);
  view.setUint32(52, 1, true);
  view.setUint32(56, 0x100, true);
  view.setUint32(64, address, true);
  view.setUint32(68, data.length, true);
  bytes.set(data, 0x100);
  return buffer;
}

describe("parseFirmwareElf", () => {
  test("returns loadable segments inside SAM7 flash", () => {
    const segments = parseFirmwareElf(firmwareElf());
    expect(segments).toHaveLength(1);
    expect(segments[0].address).toBe(0x100000);
    expect(Array.from(segments[0].data)).toEqual([1, 2, 3, 4]);
  });

  test("ignores loadable segments outside the flash window", () => {
    expect(parseFirmwareElf(firmwareElf(0x200000))).toEqual([]);
  });

  test("rejects invalid files", () => {
    expect(() => parseFirmwareElf(new ArrayBuffer(52))).toThrow("Invalid ELF magic");
  });
});
