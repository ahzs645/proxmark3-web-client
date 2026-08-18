import type { CommandJob } from "@/features/commands/types";
import type { ParsedLfCredential } from "../lfParse";
import {
  type LfBlankValidation,
  type LfCredentialVerification,
  validateLfBlank,
  verifyLfCredential,
} from "./verification";

export interface LfWorkflowRunner {
  runAndWait: (command: string, origin?: string, timeoutMs?: number) => Promise<CommandJob>;
}

export interface LfBlankInspectionResult {
  validation: LfBlankValidation;
  jobs: CommandJob[];
}

export interface LfWriteResult {
  verification: LfCredentialVerification;
  jobs: CommandJob[];
}

function output(job: CommandJob): string {
  return job.outputTail.join("\n");
}

function commandFailed(job: CommandJob): boolean {
  return job.status === "stopped" || job.resultKind === "failure";
}

/** Read-only carrier inspection used before an LF write is armed. */
export async function inspectLfBlank(runner: LfWorkflowRunner): Promise<LfBlankInspectionResult> {
  const detect = await runner.runAndWait("lf t55xx detect", "lf-verified-write");
  if (commandFailed(detect)) {
    return {
      jobs: [detect],
      validation: validateLfBlank(output(detect), ""),
    };
  }

  // Searching after chip detection is what distinguishes an unused-looking
  // carrier from one that already contains a decodable credential.
  const search = await runner.runAndWait("lf search", "lf-verified-write");
  return {
    jobs: [detect, search],
    validation: validateLfBlank(output(detect), output(search)),
  };
}

/** Write one LF credential, wait for completion, then require structural read-back equality. */
export async function executeVerifiedLfWrite(
  runner: LfWorkflowRunner,
  expected: ParsedLfCredential,
  writeCommand: string,
  onStage?: (stage: "writing" | "verifying") => void,
): Promise<LfWriteResult> {
  onStage?.("writing");
  const write = await runner.runAndWait(writeCommand, "lf-verified-write");
  if (commandFailed(write)) {
    return {
      jobs: [write],
      verification: {
        actual: null,
        passed: false,
        summary: write.resultSummary
          ? `Write failed: ${write.resultSummary}`
          : "Write failed before verification could run.",
        checks: [
          {
            id: "write-command",
            label: "Write command",
            state: "error",
            detail:
              write.resultSummary ?? "The PM3 client reported that the write did not complete.",
            blocking: true,
          },
        ],
      },
    };
  }

  onStage?.("verifying");
  const readback = await runner.runAndWait("lf search", "lf-verified-write");
  const verification = verifyLfCredential(expected, output(readback));
  return { jobs: [write, readback], verification };
}
