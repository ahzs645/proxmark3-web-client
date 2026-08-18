import { describe, expect, test } from "vite-plus/test";
import { classifyOperation, operationFromJob } from "./classify";
import type { CommandJob } from "../commands/types";

describe("operation audit records", () => {
  test.each([
    ["hf mf autopwn --1k", "attack"],
    ["lf hid clone -r AABBCCDD", "write"],
    ["lf t55xx wipe", "erase"],
    ["hf search", "read"],
    ["hw version", "device"],
  ] as const)("classifies %s", (command, kind) => {
    expect(classifyOperation(command)).toBe(kind);
  });

  test("preserves verification evidence in a bounded durable record", () => {
    const job: CommandJob = {
      id: "job-1",
      command: "lf search",
      origin: "guided-clone",
      status: "done",
      queuedAt: 10,
      startedAt: 20,
      endedAt: 50,
      completionObserved: true,
      outputTail: ["[+] HID Prox ID found"],
      resultKind: "success",
      resultSummary: "HID verified",
    };
    expect(operationFromJob(job, { targetUid: "AA", transport: "WebSerial" })).toMatchObject({
      id: "job-1",
      status: "succeeded",
      durationMs: 30,
      targetUid: "AA",
      transport: "WebSerial",
    });
  });
});
