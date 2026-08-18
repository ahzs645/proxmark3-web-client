import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CommandDispatchResult } from "@/hooks/proxmark-wasm/types";
import {
  appendJob,
  clearFinishedJobs,
  finishJob,
  findQueued,
  findRunning,
  makeJobId,
  stopAll,
} from "./jobs";
import { isPromptLine, summarizeOutputLine } from "./prompt";
import type { CommandCenter, CommandJob } from "./types";
import { applyCommandOutput } from "./progress";

interface UseCommandCenterArgs {
  /**
   * Hand the command to the pm3 client. Return null if it was not sent at all;
   * otherwise a promise describing how it ended.
   */
  dispatch: (command: string) => Promise<CommandDispatchResult> | null;
  /** Send Ctrl+C to the client. */
  interrupt: () => void;
  /**
   * Drain any pm3 output still sitting in the buffer. Called immediately before
   * a command is dispatched so output produced beforehand is attributed to the
   * previous command, not the new one.
   */
  flushOutput?: () => void;
}

/** How often the live output line is pushed into React state while a job runs. */
const TICK_MS = 250;

/**
 * How long an *untracked* command may produce no output before it is treated as
 * finished. Only reached on the stdin path (WebSerial), where the client offers
 * no completion callback and some builds do not re-print their prompt.
 */
const UNTRACKED_IDLE_MS = 8000;

/**
 * Crypto attacks can legitimately spend a long time computing between complete
 * output lines. Raw chunk activity keeps these live in the common case, while
 * this wider fallback prevents the UI from declaring them done mid-attack.
 */
const LONG_RUNNING_IDLE_MS = 5 * 60 * 1000;
const LONG_RUNNING_COMMAND = /\b(?:autopwn|hardnested|nested|darkside)\b/i;

export function untrackedIdleTimeoutMs(command: string): number {
  return LONG_RUNNING_COMMAND.test(command) ? LONG_RUNNING_IDLE_MS : UNTRACKED_IDLE_MS;
}

/**
 * Turns fire-and-forget command writes into observable jobs.
 *
 * This is what lets a running command be visible from any workspace — with its
 * elapsed time, latest output line and a stop button — instead of the terminal
 * being the only place that knows anything is happening.
 */
export function useCommandCenter({
  dispatch,
  interrupt,
  flushOutput,
}: UseCommandCenterArgs): CommandCenter {
  const [jobs, setJobs] = useState<CommandJob[]>([]);
  const [activeLine, setActiveLine] = useState("");

  // Output arrives far faster than it is worth re-rendering for, so the live
  // line is staged in a ref and flushed on a timer.
  const jobsRef = useRef<CommandJob[]>(jobs);
  const pendingLineRef = useRef<string | null>(null);
  const lastOutputAtRef = useRef(0);
  const dispatchRef = useRef(dispatch);
  const interruptRef = useRef(interrupt);
  const flushOutputRef = useRef(flushOutput);

  jobsRef.current = jobs;
  dispatchRef.current = dispatch;
  interruptRef.current = interrupt;
  flushOutputRef.current = flushOutput;

  // Keeps the ref in step with the state inside a single update, so a command
  // fired twice in the same tick still queues correctly.
  const updateJobs = useCallback((update: (jobs: CommandJob[]) => CommandJob[]) => {
    setJobs((prev) => {
      const next = update(prev);
      jobsRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (pendingLineRef.current !== null) {
        const next = pendingLineRef.current;
        pendingLineRef.current = null;
        setActiveLine(next);
      }

      const running = findRunning(jobsRef.current);
      if (!running || running.completionObserved || !running.startedAt) return;
      const quietSince = Math.max(running.startedAt, lastOutputAtRef.current);
      const idleLimit = untrackedIdleTimeoutMs(running.command);
      if (Date.now() - quietSince < idleLimit) return;
      updateJobs((prev) => finishJob(prev, running.id, Date.now(), "done"));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [updateJobs]);

  const noteOutputActivity = useCallback(() => {
    if (findRunning(jobsRef.current)) lastOutputAtRef.current = Date.now();
  }, []);

  const noteOutputLine = useCallback(
    (line: string) => {
      const running = findRunning(jobsRef.current);
      if (!running) return;
      lastOutputAtRef.current = Date.now();

      // Builds whose client re-prints the prompt after each command give us an
      // exact completion signal; take it when it is offered.
      if (isPromptLine(line)) {
        pendingLineRef.current = null;
        setActiveLine("");
        updateJobs((prev) => finishJob(prev, running.id, Date.now(), "done"));
        return;
      }

      const summary = summarizeOutputLine(line);
      if (summary) pendingLineRef.current = summary;
      updateJobs((prev) =>
        prev.map((job) => (job.id === running.id ? applyCommandOutput(job, line) : job)),
      );
    },
    [updateJobs],
  );

  const run = useCallback(
    (command: string, origin = "workbench"): CommandJob | null => {
      const trimmed = command.trim();
      if (!trimmed) return null;

      // Attribute output produced before now to the previous command.
      flushOutputRef.current?.();

      const outcome = dispatchRef.current(trimmed);
      if (!outcome) return null;

      const id = makeJobId();
      const now = Date.now();
      const wasIdle = findRunning(jobsRef.current) === null;
      if (wasIdle) {
        pendingLineRef.current = null;
        lastOutputAtRef.current = now;
        setActiveLine("");
      }

      let created: CommandJob | null = null;
      updateJobs((prev) => {
        const { jobs: next, job } = appendJob(prev, { id, command: trimmed, origin, now });
        created = job;
        return next;
      });

      void outcome.then((result) => {
        if (result === "queued") {
          // stdin path: no completion callback, fall back to the idle watchdog.
          updateJobs((prev) =>
            prev.map((job) => (job.id === id ? { ...job, completionObserved: false } : job)),
          );
          return;
        }
        updateJobs((prev) => {
          const withResult = prev.map((job) =>
            job.id === id && result === "failed"
              ? {
                  ...job,
                  resultKind: "failure" as const,
                  resultSummary: job.resultSummary ?? "Command dispatch failed",
                }
              : job,
          );
          return finishJob(withResult, id, Date.now(), result === "failed" ? "stopped" : "done");
        });
      });

      return created;
    },
    [updateJobs],
  );

  const waitForJob = useCallback((id: string, timeoutMs = 120_000): Promise<CommandJob> => {
    const startedAt = Date.now();
    return new Promise((resolve, reject) => {
      const timer = window.setInterval(() => {
        const job = jobsRef.current.find((candidate) => candidate.id === id);
        if (job && (job.status === "done" || job.status === "stopped")) {
          window.clearInterval(timer);
          resolve(job);
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          window.clearInterval(timer);
          reject(new Error(`Timed out waiting for command: ${job?.command ?? id}`));
        }
      }, 50);
    });
  }, []);

  const runAndWait = useCallback(
    async (command: string, origin = "workflow", timeoutMs = 120_000): Promise<CommandJob> => {
      const job = run(command, origin);
      if (!job) throw new Error("The PM3 client is not ready to run this command.");
      return waitForJob(job.id, timeoutMs);
    },
    [run, waitForJob],
  );

  const stopActive = useCallback(() => {
    interruptRef.current();
    pendingLineRef.current = null;
    setActiveLine("");
    updateJobs((prev) => stopAll(prev, Date.now()));
  }, [updateJobs]);

  const clearFinished = useCallback(() => {
    updateJobs((prev) => clearFinishedJobs(prev));
  }, [updateJobs]);

  const activeJob = useMemo(() => findRunning(jobs), [jobs]);
  const queuedJobs = useMemo(() => findQueued(jobs), [jobs]);

  return useMemo(
    () => ({
      jobs,
      activeJob,
      queuedJobs,
      isBusy: activeJob !== null,
      activeLine,
      run,
      runAndWait,
      waitForJob,
      stopActive,
      clearFinished,
      noteOutputActivity,
      noteOutputLine,
    }),
    [
      jobs,
      activeJob,
      queuedJobs,
      activeLine,
      run,
      runAndWait,
      waitForJob,
      stopActive,
      clearFinished,
      noteOutputActivity,
      noteOutputLine,
    ],
  );
}
