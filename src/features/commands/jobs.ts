import type { CommandJob, CommandJobStatus } from "./types";

/** How many finished jobs the session log keeps. */
export const JOB_LOG_LIMIT = 50;

export function makeJobId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `job-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

/** The job currently executing, if any. Jobs are stored newest-first. */
export function findRunning(jobs: CommandJob[]): CommandJob | null {
  return jobs.find((job) => job.status === "running") ?? null;
}

/** Jobs waiting behind the running one, in the order they were dispatched. */
export function findQueued(jobs: CommandJob[]): CommandJob[] {
  return jobs.filter((job) => job.status === "queued").reverse();
}

function trim(jobs: CommandJob[]): CommandJob[] {
  if (jobs.length <= JOB_LOG_LIMIT) return jobs;
  // Never drop work that has not finished, however long the log gets.
  const kept: CommandJob[] = [];
  for (const job of jobs) {
    const finished = job.status === "done" || job.status === "stopped";
    if (!finished || kept.length < JOB_LOG_LIMIT) kept.push(job);
  }
  return kept;
}

/**
 * Append a dispatched command. It starts `running` when the client is idle and
 * `queued` when something is already in flight — the pm3 client executes
 * commands serially, so a second command genuinely waits for the first.
 */
export function appendJob(
  jobs: CommandJob[],
  job: Pick<CommandJob, "id" | "command" | "origin"> & { now: number },
): { jobs: CommandJob[]; job: CommandJob } {
  const busy = findRunning(jobs) !== null;
  const next: CommandJob = {
    id: job.id,
    command: job.command,
    origin: job.origin,
    status: busy ? "queued" : "running",
    queuedAt: job.now,
    startedAt: busy ? null : job.now,
    endedAt: null,
    completionObserved: true,
  };
  return { jobs: trim([next, ...jobs]), job: next };
}

function promote(jobs: CommandJob[], finishedId: string, now: number): CommandJob[] {
  const promoted = findQueued(jobs).find((job) => job.id !== finishedId) ?? null;
  if (!promoted) return jobs;
  return jobs.map((job) =>
    job.id === promoted.id ? { ...job, status: "running" as const, startedAt: now } : job,
  );
}

/**
 * Finish a specific job and promote the oldest queued one in its place. Called
 * when the client reports the command returned, when the prompt reappears, or
 * when the fallback decides an untracked command has gone quiet.
 */
export function finishJob(
  jobs: CommandJob[],
  id: string,
  now: number,
  status: Extract<CommandJobStatus, "done" | "stopped">,
  options: { completionObserved?: boolean } = {},
): CommandJob[] {
  const target = jobs.find((job) => job.id === id);
  if (!target || (target.status !== "running" && target.status !== "queued")) return jobs;

  const finished = jobs.map((job) =>
    job.id === id
      ? {
          ...job,
          status,
          endedAt: now,
          completionObserved: options.completionObserved ?? job.completionObserved,
        }
      : job,
  );
  return trim(target.status === "running" ? promote(finished, id, now) : finished);
}

/** Finish whichever job is currently running. */
export function finishRunning(
  jobs: CommandJob[],
  now: number,
  status: Extract<CommandJobStatus, "done" | "stopped">,
  options: { completionObserved?: boolean } = {},
): CommandJob[] {
  const running = findRunning(jobs);
  if (!running) return jobs;
  return finishJob(jobs, running.id, now, status, options);
}

/**
 * Interrupt: the active job is marked stopped and everything queued behind it
 * is dropped, matching what Ctrl+C does to the client's pending input.
 */
export function stopAll(jobs: CommandJob[], now: number): CommandJob[] {
  return trim(
    jobs.map((job) =>
      job.status === "running" || job.status === "queued"
        ? { ...job, status: "stopped" as const, endedAt: now }
        : job,
    ),
  );
}

/** Drop finished jobs from the log, keeping anything still in flight. */
export function clearFinishedJobs(jobs: CommandJob[]): CommandJob[] {
  return jobs.filter((job) => job.status === "running" || job.status === "queued");
}
