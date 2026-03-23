import type { Block, PM3DumpJson } from "@/features/memory/types";

export function dumpToBlocks(dump: PM3DumpJson): Block[] {
  if (!dump.blocks) return generateClassic1KData();

  const blockNumbers = Object.keys(dump.blocks)
    .map(Number)
    .sort((a, b) => a - b);

  return blockNumbers.map((index) => {
    const sector = Math.floor(index / 4);
    const blockInSector = index % 4;
    const data = dump.blocks?.[index.toString()] || "00000000000000000000000000000000";

    if (index === 0) {
      return { index, sector, data, kind: "manufacturer", label: "Manufacturer" };
    }

    if (blockInSector === 3) {
      return { index, sector, data, kind: "trailer", label: "Sector Trailer" };
    }

    return { index, sector, data, kind: "data", label: "Data" };
  });
}

export function generateClassic1KData(): Block[] {
  const blocks: Block[] = [];

  for (let sector = 0; sector < 16; sector++) {
    for (let block = 0; block < 4; block++) {
      const index = sector * 4 + block;
      let kind: Block["kind"] = "data";
      let label = "Data";
      let data = "00000000000000000000000000000000";

      if (index === 0) {
        kind = "manufacturer";
        label = "Manufacturer";
        data = "3DD6CCC2E5088400E2934603127660D9";
      } else if (block === 3) {
        kind = "trailer";
        label = "Sector Trailer";
        data = "FFFFFFFFFFFF FF078069 FFFFFFFFFFFF";
      }

      blocks.push({ index, sector, data, kind, label });
    }
  }

  return blocks;
}

export function generateUltralightData(): Block[] {
  return Array.from({ length: 16 }, (_, index) => ({
    index,
    sector: 0,
    data: index < 2 ? `048FC929200000${index === 0 ? "09" : "48"}` : "00000000",
    kind: (index < 2 ? "manufacturer" : index === 2 ? "trailer" : "data") as Block["kind"],
    label: index < 2 ? "UID/BCC" : index === 2 ? "Lock/OTP" : "User Data",
  }));
}
