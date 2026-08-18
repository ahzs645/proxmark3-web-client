import { describe, expect, test } from "vite-plus/test";
import type { CommandJob } from "../commands/types";
import type { OperationCheckRecord } from "../vault/db";
import {
  parseUidFromHfOutput,
  runVerifiedMagicBlock0Write,
  runVerifiedMagicUidWrite,
} from "./verified";

function job(
  command: string,
  lines: string[],
  resultKind: CommandJob["resultKind"] = "success",
): CommandJob {
  return {
    id: command,
    command,
    origin: "test",
    status: "done",
    queuedAt: 1,
    startedAt: 1,
    endedAt: 2,
    completionObserved: true,
    outputTail: lines,
    resultKind,
  };
}

describe("verified magic UID writes", () => {
  test("normalizes UID output", () => {
    expect(parseUidFromHfOutput("[+] UID: 01 02 03 04")).toBe("01020304");
    expect(parseUidFromHfOutput("[+] UID.... 04:A1:B2:C3:D4:E5:F6")).toBe("04A1B2C3D4E5F6");
  });

  test("verifies every manufacturer-block byte after a magic write", async () => {
    const expected = "01020304040800040000000000000000";
    const runner = {
      runAndWait: async (command: string) => {
        if (command === "hf mf info") return job(command, ["[+] Magic capabilities... Gen 1a"]);
        if (command.startsWith("hf mf rdbl")) {
          return job(command, [" 0 | 01 02 03 04 04 08 00 04 00 00 00 00 00 00 00 00"]);
        }
        return job(command, ["[+] block written"]);
      },
    };
    const result = await runVerifiedMagicBlock0Write(runner, {
      cardType: "gen1a",
      expectedData: expected,
      writeCommand: `hf mf csetblk --blk 0 -d ${expected}`,
      readbackCommand: "hf mf rdbl --blk 0 -a -k FFFFFFFFFFFF",
    });
    expect(result.passed).toBe(true);
    expect(result.checks.at(-1)?.id).toBe("block0-readback");
  });

  test("runs preflight, write, and exact read-back in order", async () => {
    const commands: string[] = [];
    const runner = {
      runAndWait: async (command: string) => {
        commands.push(command);
        if (command === "hf mf info") return job(command, ["[+] Magic capabilities... Gen 1a"]);
        if (command === "hf 14a info") return job(command, ["[+] UID: 01 02 03 04"]);
        return job(command, ["[+] Card UID changed"]);
      },
    };
    const result = await runVerifiedMagicUidWrite(runner, {
      cardType: "gen1a",
      uid: "01020304",
      writeCommand: "hf mf csetuid -u 01020304",
    });

    expect(commands).toEqual(["hf mf info", "hf mf csetuid -u 01020304", "hf 14a info"]);
    expect(result.passed).toBe(true);
  });

  test("blocks writing when the magic generation does not match", async () => {
    const commands: string[] = [];
    const runner = {
      runAndWait: async (command: string) => {
        commands.push(command);
        return job(command, ["[+] Magic capabilities... Gen 2 / CUID"]);
      },
    };
    const result = await runVerifiedMagicUidWrite(runner, {
      cardType: "gen1a",
      uid: "01020304",
      writeCommand: "hf mf csetuid -u 01020304",
    });

    expect(commands).toEqual(["hf mf info"]);
    expect(result.passed).toBe(false);
  });

  test("fails when read-back UID differs", async () => {
    const runner = {
      runAndWait: async (command: string) =>
        command === "hf mf info"
          ? job(command, ["[+] Magic capabilities... Gen 1a"])
          : command === "hf 14a info"
            ? job(command, ["[+] UID: DE AD BE EF"])
            : job(command, ["[+] Card UID changed"]),
    };
    const result = await runVerifiedMagicUidWrite(runner, {
      cardType: "gen1a",
      uid: "01020304",
      writeCommand: "hf mf csetuid -u 01020304",
    });

    expect(result.passed).toBe(false);
    expect(
      result.checks.find((item: OperationCheckRecord) => item.id === "uid-readback")?.detail,
    ).toContain("DEADBEEF");
  });
});
