import { describe, expect, it } from "vite-plus/test";
import { vaultStats } from "./vault";

describe("vaultStats", () => {
  it("includes persisted LF credentials in the card headline", () => {
    expect(vaultStats([{}], [{}, {}], [{}, {}, {}], [{}], [{}, {}])).toEqual({
      cards: 3,
      keys: 3,
      dumps: 1,
      files: 2,
      operations: 0,
    });
  });
});
