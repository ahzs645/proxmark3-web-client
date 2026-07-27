export type CommandJobStatus = "queued" | "running" | "done" | "stopped";

/**
 * One command the workbench dispatched to the pm3 client. Jobs make a running
 * command a first-class piece of state instead of a fire-and-forget write into
 * stdin, so the shell can show what is in flight while you work in another tab.
 */
export interface CommandJob {
  id: string;
  command: string;
  status: CommandJobStatus;
  /** Where the command was fired from (panel/ribbon/terminal), for the log. */
  origin: string;
  queuedAt: number;
  startedAt: number | null;
  endedAt: number | null;
  /**
   * False when the client could not tell us the command finished (the stdin
   * path used for WebSerial), in which case completion is inferred from the
   * output going quiet. Surfaced so the UI can be honest about the difference.
   */
  completionObserved: boolean;
}

export interface CommandCenter {
  /** Most recent first, capped — the session's command log. */
  jobs: CommandJob[];
  /** The job currently executing on the pm3 client, if any. */
  activeJob: CommandJob | null;
  /** Jobs dispatched behind the active one, oldest first. */
  queuedJobs: CommandJob[];
  isBusy: boolean;
  /** Last non-empty output line of the active job (throttled for rendering). */
  activeLine: string;
  /** Dispatch a command. Returns the job, or null if it was not sent. */
  run: (command: string, origin?: string) => CommandJob | null;
  /** Interrupt the active job (Ctrl+C) and drop anything queued behind it. */
  stopActive: () => void;
  /** Forget completed jobs (the running one is kept). */
  clearFinished: () => void;
  /** Feed one line of pm3 output in; drives completion detection. */
  noteOutputLine: (line: string) => void;
}
