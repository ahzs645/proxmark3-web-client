import { describe, expect, it } from "vite-plus/test";
import { type2Options } from "../operations/profiles";
import { NTAG213 } from "./profiles";
import type { ParsedMfuDump } from "./mfu";
import {
  buildWriteCommands,
  hasBlockingChecks,
  planType2Erase,
  planType2Write,
  type2Preflight,
} from "./workflow";

function baseline(): ParsedMfuDump {
  const pages = new Uint8Array((44 + 1) * 4);
  pages.set([0xe1, 0x10, 0x12, 0], 12);
  pages[41 * 4 + 3] = 0xff;
  return {
    header: new Uint8Array(56),
    pages,
    maxPage: 44,
    uid: new Uint8Array(7),
    staticLock: new Uint8Array(2),
    dynamicLock: new Uint8Array(3),
    auth0: 0xff,
    capabilityContainer: pages.slice(12, 16),
    profile: NTAG213,
  };
}

describe("Type 2 workflow planning", () => {
  it("passes an unlocked known profile and rejects an active lock", () => {
    const safe = baseline();
    expect(hasBlockingChecks(type2Preflight(safe, type2Options("recommended")))).toBe(false);
    safe.staticLock[0] = 1;
    expect(hasBlockingChecks(type2Preflight(safe, type2Options("recommended")))).toBe(true);
  });

  it("builds a two-phase write with bounded commands", () => {
    const tlv = new Uint8Array([0x03, 1, 0xd0, 0xfe]);
    const plan = planType2Write(baseline(), tlv, type2Options("recommended"));
    expect(plan.invalidate?.page).toBe(4);
    expect(plan.commit?.data).toEqual(tlv);
    expect(
      buildWriteCommands(plan.changedPages, 2).every((command) => command.split("; ").length <= 2),
    ).toBe(true);
  });

  it("clears NDEF without zeroing unrelated bytes", () => {
    const dump = baseline();
    dump.pages.set([0x03, 2, 0xaa, 0xbb, 0xfe, 0x99, 0x88, 0x77], 16);
    const plan = planType2Erase(dump, "ndef");
    expect(Array.from(plan.targetArea.slice(0, 8))).toEqual([
      0x03, 0, 0, 0, 0xfe, 0x99, 0x88, 0x77,
    ]);
  });
});
