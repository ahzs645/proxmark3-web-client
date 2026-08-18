import { describe, expect, it } from "vite-plus/test";
import {
  authCandidates,
  buildReadBlockCommand,
  buildWriteBlockCommand,
  parseReadBlockData,
} from "./batch";
import type { Block } from "../types";

const block: Block = { index: 4, sector: 1, data: "00".repeat(16), kind: "data", label: "Data" };

describe("MIFARE batch helpers", () => {
  it("orders saved A/B keys before fallbacks without duplicates", () => {
    const candidates = authCandidates(
      block,
      { "1": { KeyA: "A0A1A2A3A4A5", KeyB: "B0B1B2B3B4B5" } },
      "A",
      "FFFFFFFFFFFF",
    );
    expect(candidates.slice(0, 2)).toEqual([
      { keyType: "a", key: "A0A1A2A3A4A5" },
      { keyType: "b", key: "B0B1B2B3B4B5" },
    ]);
    expect(new Set(candidates.map((item) => `${item.keyType}:${item.key}`)).size).toBe(
      candidates.length,
    );
  });

  it("builds bounded explicit commands", () => {
    const auth = { keyType: "a" as const, key: "FFFFFFFFFFFF" };
    expect(buildReadBlockCommand(4, auth)).toBe("hf mf rdbl --blk 4 -a -k FFFFFFFFFFFF");
    expect(buildWriteBlockCommand(4, "00".repeat(16), auth)).toContain("--force");
    expect(() => buildWriteBlockCommand(4, "00", auth)).toThrow(/Unsafe/);
  });

  it("parses labeled and table-shaped readback", () => {
    expect(parseReadBlockData("[+] data: 00 11 22 33 44 55 66 77 88 99 AA BB CC DD EE FF", 4)).toBe(
      "00112233445566778899AABBCCDDEEFF",
    );
    expect(parseReadBlockData("  4 | 00 11 22 33 44 55 66 77 88 99 AA BB CC DD EE FF |", 4)).toBe(
      "00112233445566778899AABBCCDDEEFF",
    );
  });
});
