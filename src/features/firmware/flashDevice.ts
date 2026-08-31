/**
 * Per-chip flash geometry, mirroring upstream `client/src/flash.c`
 * (`flash_dev_at91_init` / `flash_dev_at32_init`). Keeping the constants and the
 * derivation identical to upstream means that when the bootloader protocol
 * evolves we mirror the same change in one place rather than inventing a
 * parallel scheme.
 *
 * - AT91SAM7 = Proxmark3 (PM3GENERIC / PM3RDV4)
 * - AT32F435/437 = Proxmark5 (PM5)
 */

/** Values of upstream's `enum` in include/common.h (CMD_CHIP_TYPE arg0). */
export const MAIN_CHIP_TYPE = {
  AT91: 0,
  AT32: 1,
  NONE: 0x7fffffff,
} as const;

export type ChipFamily = "at91" | "at32";

// AT91 (Proxmark3) — FLASH at 0x0010_0000, 512-byte write blocks, 0x2000 bootrom.
const FLASH_START_AT91 = 0x00100000;
const BLOCK_SIZE_AT91 = 0x200;
const BOOTLOADER_SIZE_AT91 = 0x2000;

// AT32 (Proxmark5) — FLASH at 0x0800_0000, 0x4000 bootrom, 2K/4K erase-write unit.
const FLASH_START_AT32 = 0x08000000;
const BOOTLOADER_SIZE_AT32 = 0x4000;

export interface FlashGeometry {
  family: ChipFamily;
  /** First byte of program flash. */
  flashStart: number;
  /** One past the last writable byte (flashStart + size). */
  flashEnd: number;
  /** End of the bootloader region; writes below this need the unlock magic. */
  bootEnd: number;
  /** Erase/write unit the bootloader accumulates before programming. */
  blockSize: number;
}

export function chipFamilyFromType(chipType: number): ChipFamily {
  return chipType === MAIN_CHIP_TYPE.AT32 ? "at32" : "at91";
}

/**
 * Derive the flash layout the same way upstream does: base addresses are fixed
 * per family, the end comes from the device-reported flash size, and the AT32
 * block size steps up to 4K only on parts larger than 1 MB.
 */
export function flashGeometry(family: ChipFamily, flashKB: number): FlashGeometry {
  if (family === "at32") {
    return {
      family,
      flashStart: FLASH_START_AT32,
      flashEnd: FLASH_START_AT32 + flashKB * 1024,
      bootEnd: FLASH_START_AT32 + BOOTLOADER_SIZE_AT32,
      blockSize: flashKB > 1024 ? 0x1000 : 0x800,
    };
  }
  return {
    family,
    flashStart: FLASH_START_AT91,
    flashEnd: FLASH_START_AT91 + flashKB * 1024,
    bootEnd: FLASH_START_AT91 + BOOTLOADER_SIZE_AT91,
    blockSize: BLOCK_SIZE_AT91,
  };
}

/**
 * ELF `.version_information` magics (include/common.h). The bootrom rejects a
 * `FINISH_WRITE` whose magic is a *known* magic that doesn't match the running
 * device, which is what stops a PM3 image being written to a PM5 and vice
 * versa — so we forward the ELF's own magic and preserve that guard.
 */
export const VERSION_INFORMATION_MAGIC_PM3V = 0x56334d50; // "PM3V"
export const VERSION_INFORMATION_MAGIC_PM5V = 0x56354d50; // "PM5V"

/** The chip family an image is built for, from its version-information magic. */
export function imageFamilyFromMagic(magic: number | null): ChipFamily | null {
  if (magic === VERSION_INFORMATION_MAGIC_PM5V) return "at32";
  if (magic === VERSION_INFORMATION_MAGIC_PM3V) return "at91";
  return null;
}
