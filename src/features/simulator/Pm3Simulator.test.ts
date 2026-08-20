import { describe, expect, test } from "vite-plus/test";
import { Pm3Simulator } from "./Pm3Simulator";

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const strip = (s: string) => s.replace(ANSI, "");

/** Run a command and return the emitted output as plain (ANSI-stripped) text. */
async function run(sim: Pm3Simulator, command: string): Promise<string> {
  let out = "";
  const result = await sim.execute(command, (text) => {
    out += text;
  });
  expect(result).toBe("completed");
  return strip(out);
}

function fresh(): Pm3Simulator {
  return new Pm3Simulator({ sleep: async () => {} });
}

describe("Pm3Simulator", () => {
  test("hf search reports the real captured 4K card", async () => {
    const out = await run(fresh(), "hf search");
    expect(out).toContain("84 F0 B2 40");
    expect(out).toContain("MIFARE Classic 4K");
    expect(out).toContain("pm3 -->");
  });

  test("reading a non-default sector fails before recovery, succeeds after autopwn", async () => {
    const sim = fresh();
    // Sector 1 (blocks 4-7) uses key F4EF6D08942F, not the default.
    const before = await run(sim, "hf mf rdbl --blk 5 -k FFFFFFFFFFFF");
    expect(before).toContain("auth error");

    const pwn = await run(sim, "hf mf autopwn");
    expect(pwn).toContain("found keys for all 40 sectors");

    const after = await run(sim, "hf mf rdbl --blk 5 -k FFFFFFFFFFFF");
    expect(after).toContain("block   5");
    expect(after).not.toContain("auth error");
  });

  test("reading with the correct real key works without autopwn", async () => {
    const out = await run(fresh(), "hf mf rdbl --blk 4 -k F4EF6D08942F");
    expect(out).toContain("block   4");
    expect(out).toContain("25 3F"); // real block 4 data begins 25 3F ...
  });

  test("block 0 exposes the real UID/manufacturer data", async () => {
    const out = await run(fresh(), "hf mf rdbl --blk 0 -k FFFFFFFFFFFF");
    expect(out).toContain("84 F0 B2 40 86 98 02 00 E3 08 00 20 00 00 00 20");
  });

  test("write then read returns the written data (stateful)", async () => {
    const sim = fresh();
    const data = "00112233445566778899AABBCCDDEEFF";
    const write = await run(sim, `hf mf wrbl --blk 1 -k FFFFFFFFFFFF -d ${data}`);
    expect(write).toContain("wrote block 1");
    const read = await run(sim, "hf mf rdbl --blk 1 -k FFFFFFFFFFFF");
    expect(read).toContain("00 11 22 33 44 55 66 77 88 99 AA BB CC DD EE FF");
  });

  test("block 0 is read-only", async () => {
    const out = await run(
      fresh(),
      "hf mf wrbl --blk 0 -k FFFFFFFFFFFF -d 00112233445566778899AABBCCDDEEFF",
    );
    expect(out).toContain("read-only");
  });

  test("dump is blocked until keys are recovered, then writes library artifacts", async () => {
    const sim = fresh();
    const blocked = await run(sim, "hf mf dump");
    expect(blocked).toContain("unknown");

    await run(sim, "hf mf autopwn");
    const dumped = await run(sim, "hf mf dump");
    expect(dumped).toContain("Succeeded in dumping all blocks");
    // The exact lines the app parses to ingest dumps/keys into the library:
    expect(dumped).toContain("Saved to json file /home/web_user/hf-mf-84F0B240-dump.json");
    expect(dumped).toContain("Saved 4096 bytes to binary file");
    expect(dumped).toContain("Found keys have been dumped to");
  });

  test("generated dump JSON is retrievable from the virtual FS and parses", async () => {
    const sim = fresh();
    await run(sim, "hf mf autopwn");
    const bytes = sim.readFile("/home/web_user/hf-mf-84F0B240-dump.json");
    expect(bytes).not.toBeNull();
    const json = JSON.parse(new TextDecoder().decode(bytes!));
    expect(json.Card.UID).toBe("84F0B240");
    expect(json.blocks["0"]).toBe("84F0B24086980200E308002000000020");
    expect(Object.keys(json.blocks).length).toBe(256);
    expect(json.SectorKeys["1"].KeyA).toBe("F4EF6D08942F");
    // Bare filename lookup also resolves.
    expect(sim.readFile("hf-mf-84F0B240-dump.bin")?.byteLength).toBe(4096);
  });

  test("lf search reports the real HID Prox credential", async () => {
    const out = await run(fresh(), "lf search");
    expect(out).toContain("FC: 200");
    expect(out).toContain("CN: 46285");
    expect(out).toContain("Valid HID Prox ID found");
  });

  test("lf t55xx detect returns the real config block", async () => {
    const out = await run(fresh(), "lf t55xx detect");
    expect(out).toContain("00107060");
    expect(out).toContain("T55x7");
  });

  test("synthetic 1K card exposes 16 sectors of default keys", async () => {
    const sim = new Pm3Simulator({ sleep: async () => {}, cardType: "mifare-1k" });
    const search = await run(sim, "hf search");
    expect(search).toContain("MIFARE Classic 1K");
    const chk = await run(sim, "hf mf chk");
    expect(chk).toContain("all sector keys were default");
  });

  test("unknown command returns a generic completion", async () => {
    const out = await run(fresh(), "totally bogus command");
    expect(out).toContain("simulated");
    expect(out).toContain("pm3 -->");
  });

  test("interrupt aborts a long autopwn early", async () => {
    let calls = 0;
    const sim = new Pm3Simulator({
      sleep: async () => {
        calls++;
        if (calls === 3) sim.interrupt();
      },
    });
    const out = await run(sim, "hf mf autopwn");
    expect(out).toContain("aborted by user");
  });
});
