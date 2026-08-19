import { describe, expect, it } from "vite-plus/test";
import {
  parseHexBlockListing,
  parseMifareKeyBin,
  parseMifareKeyTable,
  sectorKeysFromTrailers,
  sectorTrailerBlock,
  withSectorKeys,
} from "./mifare";
import { findReferencedUid, normalizeSummaryLabels, parseLfFromCapture } from "./text";
import { planIngest } from "./plan";
import type { IngestFile } from "./types";

const encoder = new TextEncoder();

function textFile(name: string, body: string, path = name): IngestFile {
  return { name, path, bytes: encoder.encode(body) };
}

function hexBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s/g, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** The key table pm3 prints, and writes to `hf-mf-<uid>-key.txt`. */
const KEY_TABLE = `Sec | Key A        | Key B
----+--------------+--------------
  0 | FFFFFFFFFFFF | FFFFFFFFFFFF
  1 | F4EF6D08942F | 2F94086DEFF4
  2 | ------------ | 2F94086DEFF4
`;

/** The dotted-label note style used for hand-written capture summaries. */
const LF_SUMMARY = `LF side — HID Prox on T55x7  (dual-frequency card, HF UID 84F0B240)

=== Decoded credential ===
Format......... HID H10301 26-bit
Facility Code.. 200
Card Number.... 46285
Raw............ 00000000000000200591699b

=== Carrier chip (from \`lf t55xx detect\`) ===
Chip type...... T55x7
Block0 (config) 00107060
Password set... No
`;

const EM_SUMMARY = `LF card (2nd) — EM410x on T55x7

=== Decoded credential ===
Tech........... EM410x
EM410x ID...... 0000001450
Bit rate....... RF/64
`;

describe("parseMifareKeyBin", () => {
  it("reads a 1K key file as 16 Key A entries then 16 Key B entries", () => {
    const keyA = "FFFFFFFFFFFF".repeat(1) + "F4EF6D08942F".repeat(15);
    const keyB = "AAAAAAAAAAAA".repeat(16);
    const keys = parseMifareKeyBin(hexBytes(keyA + keyB));

    expect(keys?.["0"]).toEqual({ KeyA: "FFFFFFFFFFFF", KeyB: "AAAAAAAAAAAA" });
    expect(keys?.["1"]?.KeyA).toBe("F4EF6D08942F");
    expect(Object.keys(keys ?? {})).toHaveLength(16);
  });

  it("reads a 4K key file as 40 sectors", () => {
    const keys = parseMifareKeyBin(hexBytes("0F2FA5360F2F".repeat(80)));
    expect(Object.keys(keys ?? {})).toHaveLength(40);
    expect(keys?.["39"]).toEqual({ KeyA: "0F2FA5360F2F", KeyB: "0F2FA5360F2F" });
  });

  it("rejects a file whose length is not a whole sector count", () => {
    expect(parseMifareKeyBin(hexBytes("FFFFFFFFFFFF"))).toBeNull();
    expect(parseMifareKeyBin(new Uint8Array())).toBeNull();
  });
});

describe("parseMifareKeyTable", () => {
  it("reads the printed key table and skips unrecovered keys", () => {
    const keys = parseMifareKeyTable(KEY_TABLE);

    expect(keys?.["0"]).toEqual({ KeyA: "FFFFFFFFFFFF", KeyB: "FFFFFFFFFFFF" });
    expect(keys?.["1"]?.KeyA).toBe("F4EF6D08942F");
    expect(keys?.["2"]).toEqual({ KeyB: "2F94086DEFF4" });
  });

  it("returns null for text that holds no table", () => {
    expect(parseMifareKeyTable("no keys here")).toBeNull();
  });
});

describe("parseHexBlockListing", () => {
  it("reads a 64-block listing, stripping the block number column", () => {
    const lines = Array.from(
      { length: 64 },
      (_, index) => `${String(index).padStart(3)} | ${"00 ".repeat(15)}0${index % 10}`,
    ).join("\n");

    const blocks = parseHexBlockListing(lines);

    expect(Object.keys(blocks ?? {})).toHaveLength(64);
    expect(blocks?.["0"]).toBe("00".repeat(15) + "00");
    expect(blocks?.["63"]).toBe("00".repeat(15) + "03");
  });

  it("rejects a partial listing rather than importing a broken dump", () => {
    expect(parseHexBlockListing("  0 | " + "00 ".repeat(16))).toBeNull();
  });
});

describe("sectorKeysFromTrailers", () => {
  it("recovers the keys a Classic dump carries in its sector trailers", () => {
    const blocks: Record<string, string> = {};
    for (let block = 0; block < 64; block += 1) blocks[String(block)] = "00".repeat(16);
    blocks[String(sectorTrailerBlock(0))] = "FFFFFFFFFFFFFF078069FFFFFFFFFFFF";
    blocks[String(sectorTrailerBlock(1))] = "F4EF6D08942FFF0780692F94086DEFF4";

    const keys = sectorKeysFromTrailers(blocks);

    expect(keys?.["0"]).toEqual({
      KeyA: "FFFFFFFFFFFF",
      KeyB: "FFFFFFFFFFFF",
      AccessConditions: "FF078069",
    });
    expect(keys?.["1"]?.KeyA).toBe("F4EF6D08942F");
    // Sector 2's trailer is all zeros — an unread sector, not a recovered key.
    expect(keys?.["2"]).toBeUndefined();
  });
});

describe("withSectorKeys", () => {
  it("keeps keys already on the dump when merging a key file", () => {
    const merged = withSectorKeys(
      { SectorKeys: { "0": { KeyA: "AAAAAAAAAAAA" } } },
      { "0": { KeyA: "FFFFFFFFFFFF", KeyB: "BBBBBBBBBBBB" }, "1": { KeyA: "CCCCCCCCCCCC" } },
    );

    expect(merged.SectorKeys?.["0"]).toEqual({ KeyA: "AAAAAAAAAAAA", KeyB: "BBBBBBBBBBBB" });
    expect(merged.SectorKeys?.["1"]?.KeyA).toBe("CCCCCCCCCCCC");
  });
});

describe("normalizeSummaryLabels", () => {
  it("rewrites dotted labels into the shorthand pm3 prints", () => {
    const normalized = normalizeSummaryLabels(LF_SUMMARY);

    expect(normalized).toContain("FC: 200");
    expect(normalized).toContain("CN: 46285");
    expect(normalized).toContain("Block0 00107060");
  });
});

describe("parseLfFromCapture", () => {
  it("reads an HID credential out of a hand-written summary note", () => {
    expect(parseLfFromCapture(LF_SUMMARY)).toMatchObject({
      tech: "hid",
      format: "H10301",
      facilityCode: 200,
      cardNumber: 46285,
    });
  });

  it("reads an EM410x id out of a summary note", () => {
    expect(parseLfFromCapture(EM_SUMMARY)).toMatchObject({
      tech: "em410x",
      raw: "0000001450",
    });
  });

  it("still reads raw pm3 console output unchanged", () => {
    const console = "[+] [H10301 ] HID H10301 26-bit  FC: 200  CN: 46285  parity ( ok )";
    expect(parseLfFromCapture(console)).toMatchObject({ facilityCode: 200, cardNumber: 46285 });
  });
});

describe("findReferencedUid", () => {
  it("picks the HF UID a capture note mentions", () => {
    expect(findReferencedUid(LF_SUMMARY)).toBe("84F0B240");
  });

  it("returns nothing when no UID is named", () => {
    expect(findReferencedUid("no identifiers here")).toBe("");
  });
});

describe("planIngest", () => {
  it("assembles a dual-frequency capture folder into one plan", async () => {
    const dumpBytes = new Uint8Array(4096);
    // Block 0 carries the UID with a valid BCC so the importer can read it.
    dumpBytes.set([0x84, 0xf0, 0xb2, 0x40, 0x86], 0);

    const plan = await planIngest([
      {
        name: "hf-mf-84F0B240-dump.bin",
        path: "card-dumps/hf-mf-84F0B240-dump.bin",
        bytes: dumpBytes,
      },
      {
        name: "hf-mf-84F0B240-key.bin",
        path: "card-dumps/hf-mf-84F0B240-key.bin",
        bytes: hexBytes("0F2FA5360F2F".repeat(80)),
      },
      textFile("lf-hid-84F0B240.txt", LF_SUMMARY, "card-dumps/lf-hid-84F0B240.txt"),
      textFile("lf-em410x-0000001450.txt", EM_SUMMARY, "card-dumps/lf-em410x-0000001450.txt"),
      textFile("README.md", "# Notes", "card-dumps/README.md"),
    ]);

    expect(plan.dumps).toHaveLength(1);
    expect(plan.dumps[0].uid).toBe("84F0B240");
    expect(plan.dumps[0].cardType).toBe("classic-4k");
    // The 4K key file attached to the 4K dump rather than importing separately.
    expect(Object.keys(plan.dumps[0].dump.SectorKeys ?? {})).toHaveLength(40);
    expect(plan.looseKeys).toHaveLength(0);

    expect(plan.lfCards.map((entry) => entry.credential.tech)).toEqual(["hid", "em410x"]);
    expect(plan.lfCards[0].carrier?.chip).toBe("T55x7");
    expect(plan.lfCards[0].pairedUid).toBe("84F0B240");

    expect(plan.assets.map((entry) => entry.name)).toEqual(["README.md"]);
    expect(plan.dualFrequency).toBe(true);
    expect(plan.uids).toContain("84F0B240");
    expect(plan.suggestedName).toBe("card-dumps");
  });

  it("collapses one card saved in several formats into a single dump", async () => {
    const bytes = new Uint8Array(1024);
    bytes.set([0x84, 0xf0, 0xb2, 0x40, 0x86], 0);
    // The same 1K content, also saved as the hex listing pm3 writes beside it.
    const listing = Array.from({ length: 64 }, (_, block) => {
      const hex = block === 0 ? "84F0B24086" + "00".repeat(11) : "00".repeat(16);
      return `${String(block).padStart(3)} | ${hex.match(/../g)?.join(" ")}`;
    }).join("\n");

    const plan = await planIngest([
      { name: "hf-mf-dump.bin", path: "cap/hf-mf-dump.bin", bytes },
      textFile("hf-mf-dump.hex.txt", listing, "cap/hf-mf-dump.hex.txt"),
    ]);

    expect(plan.dumps).toHaveLength(1);
    expect(plan.dumps[0].sources).toEqual(["cap/hf-mf-dump.bin", "cap/hf-mf-dump.hex.txt"]);
    expect(plan.skipped).toEqual([
      { name: "cap/hf-mf-dump.hex.txt", reason: "duplicate of cap/hf-mf-dump.bin" },
    ]);
  });

  it("keeps two genuinely different dumps apart", async () => {
    const first = new Uint8Array(1024);
    first.set([0x84, 0xf0, 0xb2, 0x40, 0x86], 0);
    const second = new Uint8Array(1024);
    second.set([0x84, 0xf0, 0xb2, 0x40, 0x86], 0);
    second[16] = 0xff; // same card, different block 1 — a later snapshot.

    const plan = await planIngest([
      { name: "a.bin", path: "a.bin", bytes: first },
      { name: "b.bin", path: "b.bin", bytes: second },
    ]);

    expect(plan.dumps).toHaveLength(2);
    expect(plan.skipped).toEqual([]);
  });

  it("merges one LF credential captured across several files", async () => {
    const searchLog = "[+] [H10301 ] HID H10301 26-bit  FC: 200  CN: 46285  parity ( ok )";

    const plan = await planIngest([
      textFile("lf-search.log", searchLog, "cap/lf-search.log"),
      textFile("lf-hid.txt", LF_SUMMARY, "cap/lf-hid.txt"),
      textFile("lf-em410x.txt", EM_SUMMARY, "cap/lf-em410x.txt"),
    ]);

    expect(plan.lfCards).toHaveLength(2);
    const hid = plan.lfCards.find((entry) => entry.credential.tech === "hid");
    expect(hid?.sources).toEqual(["cap/lf-search.log", "cap/lf-hid.txt"]);
    // The carrier and HF pairing came from the note, not the search log.
    expect(hid?.carrier?.chip).toBe("T55x7");
    expect(hid?.pairedUid).toBe("84F0B240");
  });

  it("keeps unreadable files as cached notes instead of losing them", async () => {
    const plan = await planIngest([
      textFile("autopwn.log", "[=] nothing parseable here"),
      { name: "mystery.dat", path: "mystery.dat", bytes: new Uint8Array([1, 2, 3]) },
      { name: "blank.txt", path: "blank.txt", bytes: new Uint8Array() },
    ]);

    expect(plan.assets.map((entry) => entry.name)).toEqual(["autopwn.log", "mystery.dat"]);
    expect(plan.skipped).toEqual([{ name: "blank.txt", reason: "empty file" }]);
  });

  it("imports keys with no matching dump as loose keys", async () => {
    const plan = await planIngest([textFile("hf-mf-key.txt", KEY_TABLE)]);

    expect(plan.dumps).toHaveLength(0);
    expect(plan.looseKeys).toHaveLength(1);
    expect(Object.keys(plan.looseKeys[0].keys)).toEqual(["0", "1", "2"]);
  });
});

describe("LF card UID mapping", () => {
  it("files a paired credential under its HF twin's UID", async () => {
    const plan = await planIngest([textFile("lf-hid.txt", LF_SUMMARY)]);
    expect(plan.lfCards[0].pairedUid).toBe("84F0B240");
  });

  it("leaves an unpaired credential's own id to stand in", async () => {
    const plan = await planIngest([textFile("lf-em.txt", EM_SUMMARY)]);
    expect(plan.lfCards[0].pairedUid).toBe("");
    expect(plan.lfCards[0].credential.raw).toBe("0000001450");
  });
});
