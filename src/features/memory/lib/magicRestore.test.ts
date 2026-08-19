import { describe, expect, test } from "vite-plus/test";
import type { CardTarget } from "../../target/types";
import type { PM3DumpJson } from "../types";
import { equalBytes, magicSizeFlag, planMagicRestore } from "./magicRestore";

function dump(blockCount = 64): PM3DumpJson {
  const blocks: Record<string, string> = {};
  for (let block = 0; block < blockCount; block++) {
    const trailer = (block < 128 && block % 4 === 3) || (block >= 128 && (block - 128) % 16 === 15);
    blocks[String(block)] = trailer
      ? "FFFFFFFFFFFFFF078069FFFFFFFFFFFF"
      : "00000000000000000000000000000000";
  }
  blocks["0"] = "84F0B240860804006263646566676869";
  return { Card: { UID: "84F0B240", SAK: blockCount === 256 ? "18" : "08" }, blocks };
}

function target(overrides: Partial<CardTarget> = {}): CardTarget {
  return {
    identity: { uid: "F0253C3E", type: "MIFARE Classic 1K", sak: "08", protocol: "HF" },
    dump: null,
    source: "scan",
    classification: {
      family: "classic",
      size: "1k",
      protocol: "HF",
      isClassic: true,
      isUltralight: false,
      isIclass: false,
      isDesfire: false,
    },
    uid: "F0253C3E",
    savedKeys: [],
    savedKeyCount: 0,
    libraryKeys: [],
    libraryKeyCount: 0,
    relatedDumps: [],
    relatedAssets: [],
    hasCard: true,
    lf: null,
    magic: { isMagic: true, gen: "gen1a", label: "Gen 1a", at: 1 },
    updatedAt: 1,
    ...overrides,
  };
}

describe("magic restore planning", () => {
  test("allows an exact-size Gen1a restore", () => {
    const plan = planMagicRestore(dump(), target());
    expect(plan.state).toBe("ready");
    expect(plan.sourceSize).toBe("1k");
  });

  test("requires a physical target scan after a dump is loaded", () => {
    const plan = planMagicRestore(dump(), target({ source: "dump" }));
    expect(plan.state).toBe("needs-scan");
  });

  test("blocks a 4K source on a 1K target", () => {
    const plan = planMagicRestore(dump(256), target());
    expect(plan.state).toBe("blocked");
    expect(plan.checks.find((check) => check.id === "capacity-match")?.state).toBe("error");
  });

  test("routes other magic generations to their own methods", () => {
    const plan = planMagicRestore(
      dump(),
      target({ magic: { isMagic: true, gen: "gen4", label: "Gen4 GTU", at: 1 } }),
    );
    expect(plan.state).toBe("blocked");
    expect(plan.nextStep).toContain("password-aware");
  });

  test("blocks invalid block-0 BCC and trailer access bits", () => {
    const source = dump();
    source.blocks!["0"] = "84F0B240000804006263646566676869";
    source.blocks!["3"] = "FFFFFFFFFFFF00000000FFFFFFFFFFFF";
    const plan = planMagicRestore(source, target());
    expect(plan.state).toBe("blocked");
    expect(plan.checks.filter((check) => check.state === "error").map((check) => check.id)).toEqual(
      expect.arrayContaining(["manufacturer-block", "access-bits"]),
    );
  });
});

describe("magic restore artifacts", () => {
  test("compares exact readback bytes and maps size flags", () => {
    expect(equalBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(equalBytes(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(magicSizeFlag("1k")).toBe("--1k");
    expect(magicSizeFlag("4k")).toBe("--4k");
  });
});
