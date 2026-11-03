import { describe, expect, test } from "vite-plus/test";
import { parseElfImage, parseFirmwareElf } from "./elf";
import { VERSION_INFORMATION_MAGIC_PM5V } from "./flashDevice";

/**
 * Builds a minimal but structurally real ELF: one PT_LOAD segment plus a
 * `.version_information` section (with magic) reachable through a `.shstrtab`,
 * so the section-header path in the parser is genuinely exercised.
 */
function elfWithVersion(segmentAddress: number, magic: number, asBootrom = false): ArrayBuffer {
  const segData = Uint8Array.of(0xaa, 0xbb, 0xcc, 0xdd);
  // A bootrom carries no `.version_information`; its `.bootphase1` ends with a
  // pointer to the version block inside that section.
  const versionSection = asBootrom ? ".bootphase1" : ".version_information";
  const strtab = new TextEncoder().encode(`\0${versionSection}\0.shstrtab\0`);
  const nameVersion = 1;
  const nameShstrtab = 1 + versionSection.length + 1;
  const bootphaseSize = 0x20;
  const bootphaseMagicOffset = 0x8;

  const segOffset = 0x100;
  const versionOffset = 0x120;
  const strtabOffset = 0x140;
  const shOffset = 0x180;
  const buffer = new ArrayBuffer(shOffset + 3 * 40);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  bytes.set([0x7f, 0x45, 0x4c, 0x46, 1, 1]);
  view.setUint32(28, 52, true); // e_phoff
  view.setUint16(42, 32, true); // e_phentsize
  view.setUint16(44, 1, true); // e_phnum
  view.setUint32(32, shOffset, true); // e_shoff
  view.setUint16(46, 40, true); // e_shentsize
  view.setUint16(48, 3, true); // e_shnum
  view.setUint16(50, 2, true); // e_shstrndx

  // Program header: PT_LOAD
  view.setUint32(52, 1, true);
  view.setUint32(56, segOffset, true);
  view.setUint32(64, segmentAddress, true);
  view.setUint32(68, segData.length, true);
  bytes.set(segData, segOffset);

  if (asBootrom) {
    view.setUint32(versionOffset + bootphaseMagicOffset, magic, true);
    view.setUint32(versionOffset + bootphaseSize - 4, segmentAddress + bootphaseMagicOffset, true);
  } else {
    view.setUint32(versionOffset, magic, true);
  }
  bytes.set(strtab, strtabOffset);

  // Section headers: [0] null, [1] .version_information, [2] .shstrtab
  view.setUint32(shOffset + 40 + 0, nameVersion, true);
  view.setUint32(shOffset + 40 + 12, segmentAddress, true);
  view.setUint32(shOffset + 40 + 16, versionOffset, true);
  view.setUint32(shOffset + 40 + 20, asBootrom ? bootphaseSize : 4, true);
  view.setUint32(shOffset + 80 + 0, nameShstrtab, true);
  view.setUint32(shOffset + 80 + 16, strtabOffset, true);
  view.setUint32(shOffset + 80 + 20, strtab.length, true);
  return buffer;
}

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

describe("parseElfImage", () => {
  test("keeps AT32 (Proxmark5) segments that the SAM7 filter would drop", () => {
    const image = parseElfImage(elfWithVersion(0x08004000, VERSION_INFORMATION_MAGIC_PM5V));
    expect(image.segments).toHaveLength(1);
    expect(image.segments[0].address).toBe(0x08004000);
    expect(image.magic).toBe(VERSION_INFORMATION_MAGIC_PM5V);
    // The legacy SAM7-only parser still refuses the same AT32 image.
    expect(parseFirmwareElf(elfWithVersion(0x08004000, VERSION_INFORMATION_MAGIC_PM5V))).toEqual(
      [],
    );
  });

  test("reads the version-information magic for an AT91 image too", () => {
    const image = parseElfImage(elfWithVersion(0x00100000, 0x56334d50));
    expect(image.segments[0].address).toBe(0x00100000);
    expect(image.magic).toBe(0x56334d50);
  });

  test("finds a bootrom's magic through the pointer at the end of .bootphase1", () => {
    const image = parseElfImage(elfWithVersion(0x08000000, VERSION_INFORMATION_MAGIC_PM5V, true));
    expect(image.magic).toBe(VERSION_INFORMATION_MAGIC_PM5V);
  });
});
