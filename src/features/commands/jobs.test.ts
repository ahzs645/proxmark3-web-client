import { describe, expect, it } from "@voidzero-dev/vite-plus-test";
import {
  appendJob,
  clearFinishedJobs,
  findQueued,
  findRunning,
  finishJob,
  finishRunning,
  stopAll,
} from "./jobs";
import { isPromptLine, summarizeOutputLine } from "./prompt";
import type { CommandJob } from "./types";

function add(jobs: CommandJob[], command: string, now: number) {
  return appendJob(jobs, { id: command, command, origin: "test", now }).jobs;
}

describe("command jobs", () => {
  it("runs the first command and queues the rest", () => {
    let jobs = add([], "hf search", 1);
    jobs = add(jobs, "hf mf autopwn", 2);
    jobs = add(jobs, "hw version", 3);

    expect(findRunning(jobs)?.command).toBe("hf search");
    expect(findQueued(jobs).map((job) => job.command)).toEqual(["hf mf autopwn", "hw version"]);
  });

  it("promotes the oldest queued job when the running one finishes", () => {
    let jobs = add([], "hf search", 1);
    jobs = add(jobs, "hf mf autopwn", 2);

    jobs = finishRunning(jobs, 10, "done");

    expect(findRunning(jobs)?.command).toBe("hf mf autopwn");
    expect(findRunning(jobs)?.startedAt).toBe(10);
    expect(jobs.find((job) => job.command === "hf search")).toMatchObject({
      status: "done",
      endedAt: 10,
    });
  });

  it("finishes a job by id, even out of order, and promotes the next", () => {
    let jobs = add([], "hf search", 1);
    jobs = add(jobs, "hf mf autopwn", 2);

    jobs = finishJob(jobs, "hf search", 7, "done");

    expect(findRunning(jobs)?.command).toBe("hf mf autopwn");
  });

  it("finishing a queued job does not promote anything", () => {
    let jobs = add([], "hf search", 1);
    jobs = add(jobs, "hf mf autopwn", 2);

    jobs = finishJob(jobs, "hf mf autopwn", 7, "stopped");

    expect(findRunning(jobs)?.command).toBe("hf search");
    expect(findQueued(jobs)).toEqual([]);
  });

  it("finishing an already-finished job is a no-op", () => {
    let jobs = add([], "hf search", 1);
    jobs = finishJob(jobs, "hf search", 5, "done");
    const again = finishJob(jobs, "hf search", 9, "stopped");

    expect(again).toBe(jobs);
    expect(again[0]).toMatchObject({ status: "done", endedAt: 5 });
  });

  it("records when completion could not be observed", () => {
    let jobs = add([], "hf mf autopwn", 1);
    expect(jobs[0].completionObserved).toBe(true);

    jobs = finishJob(jobs, "hf mf autopwn", 20, "done", { completionObserved: false });
    expect(jobs[0]).toMatchObject({ status: "done", completionObserved: false });
  });

  it("finishing with nothing running is a no-op", () => {
    expect(finishRunning([], 5, "done")).toEqual([]);
  });

  it("stopping cancels the running job and everything queued behind it", () => {
    let jobs = add([], "hf mf autopwn", 1);
    jobs = add(jobs, "hf mf dump", 2);

    jobs = stopAll(jobs, 9);

    expect(findRunning(jobs)).toBeNull();
    expect(findQueued(jobs)).toEqual([]);
    expect(jobs.every((job) => job.status === "stopped")).toBe(true);
  });

  it("clearing the log keeps work that is still in flight", () => {
    let jobs = add([], "hf search", 1);
    jobs = finishRunning(jobs, 2, "done");
    jobs = add(jobs, "hf mf autopwn", 3);
    jobs = add(jobs, "hf mf dump", 4);

    const cleared = clearFinishedJobs(jobs);

    expect(cleared.map((job) => job.command)).toEqual(["hf mf dump", "hf mf autopwn"]);
  });
});

describe("prompt detection", () => {
  it("recognizes the pm3 prompt in its usual forms", () => {
    expect(isPromptLine("[usb] pm3 --> ")).toBe(true);
    expect(isPromptLine("[offline] pm3 --> ")).toBe(true);
    expect(isPromptLine("\u001b[32m[fpc] pm3 -->\u001b[0m ")).toBe(true);
    expect(isPromptLine("pm3 --> ")).toBe(true);
  });

  it("does not treat ordinary output as a prompt", () => {
    expect(isPromptLine("[+] Found key A: FFFFFFFFFFFF")).toBe(false);
    expect(isPromptLine("[=] Sector 0 / block 3")).toBe(false);
    expect(isPromptLine("")).toBe(false);
  });

  it("condenses output lines for the activity bar", () => {
    expect(summarizeOutputLine("\u001b[32m[+]  Found   key\u001b[0m")).toBe("Found key");
    expect(summarizeOutputLine("   ")).toBe("");
  });
});
