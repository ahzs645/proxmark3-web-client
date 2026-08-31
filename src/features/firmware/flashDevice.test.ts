import { describe, expect, test } from "vite-plus/test";
import {
  chipFamilyFromType,
  flashGeometry,
  imageFamilyFromMagic,
  MAIN_CHIP_TYPE,
  VERSION_INFORMATION_MAGIC_PM3V,
  VERSION_INFORMATION_MAGIC_PM5V,
} from "./flashDevice";

describe("flash device geometry", () => {
  test("AT32 (Proxmark5) 1 MB part uses 2K blocks from 0x08000000", () => {
    const geo = flashGeometry("at32", 1024);
    expect(geo.flashStart).toBe(0x08000000);
    expect(geo.bootEnd).toBe(0x08004000);
    expect(geo.flashEnd).toBe(0x08100000);
    expect(geo.blockSize).toBe(0x800);
  });

  test("AT32 parts larger than 1 MB step up to 4K blocks", () => {
    expect(flashGeometry("at32", 4032).blockSize).toBe(0x1000);
  });

  test("AT91 (Proxmark3) keeps the 512-byte SAM7 layout at 0x100000", () => {
    const geo = flashGeometry("at91", 512);
    expect(geo.flashStart).toBe(0x00100000);
    expect(geo.bootEnd).toBe(0x00102000);
    expect(geo.flashEnd).toBe(0x00180000);
    expect(geo.blockSize).toBe(0x200);
  });

  test("chip type maps to the right family", () => {
    expect(chipFamilyFromType(MAIN_CHIP_TYPE.AT32)).toBe("at32");
    expect(chipFamilyFromType(MAIN_CHIP_TYPE.AT91)).toBe("at91");
  });

  test("image magic identifies the target family (and rejects unknowns)", () => {
    expect(imageFamilyFromMagic(VERSION_INFORMATION_MAGIC_PM5V)).toBe("at32");
    expect(imageFamilyFromMagic(VERSION_INFORMATION_MAGIC_PM3V)).toBe("at91");
    expect(imageFamilyFromMagic(0)).toBeNull();
    expect(imageFamilyFromMagic(null)).toBeNull();
  });
});
