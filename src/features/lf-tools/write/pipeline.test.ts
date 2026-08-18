import { describe, expect, test } from "vite-plus/test";
import type { CommandJob } from "../../commands/types";
import { executeVerifiedLfWrite, inspectLfBlank } from "./pipeline";

function job(
  command: string,
  outputTail: string[],
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
    outputTail,
    resultKind,
  };
}

describe("LF write pipeline", () => {
  test("inspects the carrier before checking for existing data", async () => {
    const commands: string[] = [];
    const runner = {
      runAndWait: async (command: string) => {
        commands.push(command);
        return command.includes("detect")
          ? job(command, [
              "[+] Chip type......... T55x7",
              "[+] Block0............ 00107060",
              "[+] Password set...... No",
            ])
          : job(command, ["[-] No known 125/134 kHz tags found!"], "failure");
      },
    };

    const result = await inspectLfBlank(runner);
    expect(commands).toEqual(["lf t55xx detect", "lf search"]);
    expect(result.validation.ready).toBe(true);
  });

  test("never runs read-back after a reported write failure", async () => {
    const commands: string[] = [];
    const runner = {
      runAndWait: async (command: string) => {
        commands.push(command);
        return job(command, ["[!!] Write failed"], "failure");
      },
    };

    const result = await executeVerifiedLfWrite(
      runner,
      { tech: "em410x", raw: "0102030405", name: "source" },
      "lf em 410x clone --id 0102030405",
    );

    expect(commands).toEqual(["lf em 410x clone --id 0102030405"]);
    expect(result.verification.passed).toBe(false);
  });

  test("waits for write completion before reading back and comparing", async () => {
    const commands: string[] = [];
    const runner = {
      runAndWait: async (command: string) => {
        commands.push(command);
        return command === "lf search"
          ? job(command, ["[+] EM 410x ID 0102030405", "[+] EM410x pattern found"])
          : job(command, ["[+] Done"]);
      },
    };

    const result = await executeVerifiedLfWrite(
      runner,
      { tech: "em410x", raw: "0102030405", name: "source" },
      "lf em 410x clone --id 0102030405",
    );

    expect(commands).toEqual(["lf em 410x clone --id 0102030405", "lf search"]);
    expect(result.verification.passed).toBe(true);
  });
});
