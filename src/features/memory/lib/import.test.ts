import { describe, expect, it } from "vite-plus/test";
import { dumpImportInternals } from "./import";
import { dumpBytes } from "./export";

describe("dump import adapters", () => {
  it("round-trips a Classic 1K binary dump", () => {
    const bytes = new Uint8Array(1024);
    bytes.set([0x84, 0xf0, 0xb2, 0x40, 0x86], 0);
    const imported = dumpImportInternals.classicDumpFromBytes(bytes, "card.bin");
    expect(imported.cardType).toBe("classic-1k");
    expect(imported.dump.Card?.UID).toBe("84F0B240");
    expect(Object.keys(imported.dump.blocks ?? {})).toHaveLength(64);
    expect(dumpBytes(imported.dump)).toEqual(bytes);
  });

  it("parses indexed EML rows and ignores comments", () => {
    const row = "00000000000000000000000000000000";
    const text =
      Array.from({ length: 64 }, (_, index) => `${index}: ${row}`).join("\n") + "\n# end";
    const imported = dumpImportInternals.emlDump(text, "card.eml");
    expect(imported.cardType).toBe("classic-1k");
    expect(imported.dump.blocks?.["63"]).toBe(row);
  });

  it("parses an MFU header and page region", () => {
    const maxPage = 15;
    const bytes = new Uint8Array(56 + (maxPage + 1) * 4);
    bytes[11] = maxPage;
    bytes.set([0x04, 0x12, 0x34, 0xaa, 0x56, 0x78, 0x9a, 0xbc], 56);
    const imported = dumpImportInternals.mfuDumpFromBytes(bytes, "tag.bin");
    expect(imported.cardType).toBe("ultralight");
    expect(imported.dump.Card?.UID).toBe("04123456789ABC");
    expect(imported.dump.MfuHeader).toHaveLength(112);
    expect(imported.dump.blocks?.["15"]).toHaveLength(8);
  });
});
