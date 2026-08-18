import { describe, expect, test } from "vite-plus/test";
import { applyCommandOutput, parseCommandProgress } from "./progress";
import type { CommandJob } from "./types";

describe("command progress parsing", () => {
  test("extracts block progress", () => {
    const parsed = parseCommandProgress("hf mf restore", "[=] Writing block 32 of 64 (50%)");
    expect(parsed.progress).toMatchObject({
      phase: "writing",
      current: 32,
      total: 64,
      percent: 50,
    });
  });

  test("does not hide an earlier failure behind a later success line", () => {
    let job: CommandJob = {
      id: "sticky-failure",
      command: "lf hid clone -w H10301 --fc 1 --cn 2",
      origin: "test",
      status: "running",
      queuedAt: 1,
      startedAt: 1,
      endedAt: null,
      completionObserved: true,
      outputTail: [],
      resultKind: "unknown",
    };

    job = applyCommandOutput(job, "[!!] Write failed");
    job = applyCommandOutput(job, "[+] Command completed");

    expect(job.resultKind).toBe("failure");
    expect(job.resultSummary).toContain("Write failed");
  });

  test("tracks attack phases without fabricating percentages", () => {
    const parsed = parseCommandProgress("hf mf autopwn --1k", "Running hardnested attack");
    expect(parsed.progress?.phase).toBe("hardnested");
    expect(parsed.progress?.percent).toBeUndefined();
  });

  test("tracks autopwn keys, recovered values, artifacts, and elapsed time", () => {
    let job: CommandJob = {
      id: "autopwn-structured",
      command: "hf mf autopwn --1k",
      origin: "test",
      status: "running",
      queuedAt: 1,
      startedAt: 1,
      endedAt: null,
      completionObserved: true,
      outputTail: [],
      resultKind: "unknown",
    };

    job = applyCommandOutput(job, "[=] found 12/32 keys (D)");
    expect(job.progress).toMatchObject({
      phase: "checking dictionary",
      current: 12,
      total: 32,
      percent: 38,
      unitLabel: "keys",
    });

    job = applyCommandOutput(job, "[+] found valid key [ a0a1a2a3a4a5 ]");
    expect(job.progress?.recoveredKeys).toEqual(["A0A1A2A3A4A5"]);

    job = applyCommandOutput(job, "[+] saved 64 blocks to file hf-mf-01020304-dump.bin");
    expect(job.progress?.artifactPath).toBe("hf-mf-01020304-dump.bin");

    job = applyCommandOutput(job, "[=] autopwn execution time: 45 seconds");
    expect(job.progress).toMatchObject({ phase: "complete", percent: 100, elapsedSeconds: 45 });
    expect(job.resultSummary).toContain("12/32 keys");
  });

  test("attaches actionable recovery to attack and transport failures", () => {
    const attack = parseCommandProgress(
      "hf mf autopwn --1k",
      "[!] all key recovery attempts failed",
    );
    expect(attack.resultKind).toBe("failure");
    expect(attack.recovery).toMatchObject({ code: "attack-exhausted", retryable: true });

    const transport = parseCommandProgress("lf search", "[-] Timed out while reading serial data");
    expect(transport.recovery?.code).toBe("transport-interrupted");
  });

  test("marks partial dumps as warnings rather than successes", () => {
    const parsed = parseCommandProgress("hf mf autopwn --4k", "[!] Dump file is PARTIAL complete");
    expect(parsed.resultKind).toBe("warning");
    expect(parsed.progress?.phase).toBe("partial dump");
    expect(parsed.recovery?.code).toBe("partial-dump");
  });

  test("keeps bounded output and records failures", () => {
    let job: CommandJob = {
      id: "1",
      command: "lf search",
      origin: "test",
      status: "running",
      queuedAt: 1,
      startedAt: 1,
      endedAt: null,
      completionObserved: true,
      outputTail: [],
      resultKind: "unknown",
    };
    for (let index = 0; index < 205; index += 1) job = applyCommandOutput(job, `line ${index}`);
    job = applyCommandOutput(job, "[!!] No tag found");
    expect(job.outputTail).toHaveLength(200);
    expect(job.resultKind).toBe("failure");
    expect(job.resultSummary).toContain("No tag found");
  });
});
