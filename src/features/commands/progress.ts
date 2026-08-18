import type { CommandJob, CommandProgress, CommandRecovery, CommandResultKind } from "./types";

const ANSI_ESCAPE_CHAR = String.fromCharCode(27);
const ANSI_ESCAPE_REGEX = new RegExp(
  `${ANSI_ESCAPE_CHAR}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`,
  "g",
);

function cleanLine(line: string): string {
  return line.replace(ANSI_ESCAPE_REGEX, "").trim();
}

function boundedPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function inferPhase(command: string, line: string): string | undefined {
  const haystack = `${command} ${line}`.toLowerCase();
  if (/verify|verification|read(?:ing)? back/.test(line.toLowerCase())) return "verifying";
  if (/hardnested|brute.?forc|state space/.test(haystack)) return "hardnested";
  if (/static.?nested/.test(haystack)) return "static nested";
  if (/darkside/.test(haystack)) return "darkside";
  if (/nested/.test(haystack)) return "nested";
  if (/dictionary|known keys?|fchk|chk/.test(haystack)) return "checking keys";
  if (/autopwn/.test(haystack)) return "recovering keys";
  if (/wipe|erase/.test(haystack)) return "erasing";
  if (/restore|cload|gload|write|clone|setuid|setblk/.test(haystack)) return "writing";
  if (/dump|read/.test(haystack)) return "reading";
  if (/search|reader|info|detect/.test(haystack)) return "detecting";
  return undefined;
}

function inferResult(line: string): CommandResultKind | undefined {
  if (/\[!!\]|\b(?:failed|failure|fatal|error|not vulnerable|no tag found)\b/i.test(line)) {
    return "failure";
  }
  if (/\[!\]|\bwarning\b|may have failed/i.test(line)) return "warning";
  if (/\[\+\]|\b(?:complete|completed|success|successful|verified|saved to)\b/i.test(line)) {
    return "success";
  }
  return undefined;
}

function inferRecovery(line: string): CommandRecovery | undefined {
  if (/no tag found|no known .* tags found|card.*(?:removed|lost)/i.test(line)) {
    return {
      code: "tag-not-found",
      message: "The expected card was not detected.",
      action: "Keep the card still over the correct antenna, reposition it, and retry.",
      retryable: true,
    };
  }
  if (
    /timed?\s*out|OLD frame with payload too short|transport|serial.*(?:closed|disconnect)/i.test(
      line,
    )
  ) {
    return {
      code: "transport-interrupted",
      message: "Communication with the reader was interrupted.",
      action: "Reconnect the transport, confirm the client is attached, then retry the operation.",
      retryable: true,
    };
  }
  if (/password|auth(?:entication)? failed|wrong key|access denied/i.test(line)) {
    return {
      code: "authentication-required",
      message: "The card rejected the supplied credentials.",
      action:
        "Retry with the correct password or known key; do not continue with a destructive step.",
      retryable: true,
    };
  }
  if (/all key recovery attempts? failed|not vulnerable/i.test(line)) {
    return {
      code: "attack-exhausted",
      message: "The selected recovery methods did not recover a usable key.",
      action:
        "Re-scan the card, confirm its type, then try a different supported attack or key dictionary.",
      retryable: true,
    };
  }
  if (/write.*failed|verify.*failed|mismatch/i.test(line)) {
    return {
      code: "write-verification-failed",
      message: "The written data could not be verified.",
      action:
        "Keep the card in place, read it again, and replace the blank if the mismatch persists.",
      retryable: true,
    };
  }
  return undefined;
}

interface AttackLineResult {
  progress?: CommandProgress;
  resultKind?: CommandResultKind;
  resultSummary?: string;
  recovery?: CommandRecovery;
}

function parseAttackLine(
  command: string,
  line: string,
  previous?: CommandProgress,
): AttackLineResult {
  if (!/\b(?:autopwn|hardnested|staticnested|nested|darkside|f?chk)\b/i.test(command)) return {};

  const progress: CommandProgress = { ...previous, detail: line };
  const keys = line.match(/found\s+(\d+)\s*\/\s*(\d+)\s+keys/i);
  if (keys) {
    progress.phase = "checking dictionary";
    progress.current = Number(keys[1]);
    progress.total = Number(keys[2]);
    progress.unitLabel = "keys";
    progress.percent = progress.total
      ? boundedPercent((progress.current / progress.total) * 100)
      : 0;
    return {
      progress,
      resultSummary: `${progress.current}/${progress.total} keys recovered`,
    };
  }

  const recovered = line.match(/found\s+valid\s+key\s*\[\s*([0-9A-F]{12})\s*\]/i);
  if (recovered) {
    const key = recovered[1].toUpperCase();
    progress.phase = progress.phase ?? "recovering keys";
    progress.recoveredKeys = Array.from(new Set([...(previous?.recoveredKeys ?? []), key]));
    return { progress, resultSummary: `Recovered key ${key}` };
  }

  if (/hardnested|brute.?forc|state space/i.test(line)) progress.phase = "hardnested";
  else if (/staticnested|static nonce/i.test(line)) progress.phase = "static nested";
  else if (/darkside/i.test(line)) progress.phase = "darkside";
  else if (/nested attack|nested authentication/i.test(line)) progress.phase = "nested";

  const elapsed = line.match(/(?:autopwn\s+)?execution\s+time\s*:\s*(\d+)\s*seconds?/i);
  if (elapsed) {
    progress.phase = "complete";
    progress.percent = 100;
    progress.elapsedSeconds = Number(elapsed[1]);
    const keySummary = progress.total
      ? `; ${progress.current ?? 0}/${progress.total} keys recovered`
      : "";
    return {
      progress,
      resultKind: "success",
      resultSummary: `Attack completed in ${progress.elapsedSeconds}s${keySummary}`,
    };
  }

  const artifact = line.match(
    /saved\s+.*?(?:to\s+(?:binary\s+)?file\s+[`]?|file\s+)([^\s`]+\.(?:bin|json|eml))/i,
  );
  if (artifact) {
    progress.phase = "saving dump";
    progress.artifactPath = artifact[1];
    return { progress, resultKind: "success", resultSummary: `Saved dump to ${artifact[1]}` };
  }

  if (/Succeeded\s+in\s+dumping\s+all\s+blocks/i.test(line)) {
    progress.phase = "dump complete";
    progress.percent = 100;
    return {
      progress,
      resultKind: "success",
      resultSummary: "Recovered keys and dumped all blocks",
    };
  }
  if (/Dump\s+file\s+is\s+PARTIAL/i.test(line)) {
    progress.phase = "partial dump";
    return {
      progress,
      resultKind: "warning",
      resultSummary: "Only a partial card dump was recovered",
      recovery: {
        code: "partial-dump",
        message: "Some card blocks could not be read.",
        action:
          "Keep the card in place and retry with the recovered keys before using the dump for a write.",
        retryable: true,
      },
    };
  }
  if (/all\s+key\s+recovery\s+attempts?\s+failed/i.test(line)) {
    return {
      progress: { ...progress, phase: "failed" },
      resultKind: "failure",
      resultSummary: "All key recovery attempts failed",
      recovery: inferRecovery(line),
    };
  }

  return progress.phase ? { progress } : {};
}

const RESULT_PRIORITY: Record<CommandResultKind, number> = {
  unknown: 0,
  success: 1,
  warning: 2,
  failure: 3,
};

/** Never let a later informational success line hide an earlier failure. */
function strongerResult(
  previous: CommandResultKind,
  next: CommandResultKind | undefined,
): CommandResultKind {
  if (!next) return previous;
  return RESULT_PRIORITY[next] >= RESULT_PRIORITY[previous] ? next : previous;
}

/** Parse one PM3 output line into transport-agnostic job progress. */
export function parseCommandProgress(
  command: string,
  rawLine: string,
  previous?: CommandProgress,
): {
  progress?: CommandProgress;
  resultKind?: CommandResultKind;
  resultSummary?: string;
  recovery?: CommandRecovery;
} {
  const line = cleanLine(rawLine);
  if (!line) return {};

  const attack = parseAttackLine(command, line, previous);

  const percentMatch = line.match(/(?:^|\s)(\d{1,3}(?:\.\d+)?)\s*%/);
  const unitMatch =
    line.match(/(?:block|sector|key)s?\D{0,16}(\d+)\s*(?:\/|of)\s*(\d+)/i) ??
    line.match(/(\d+)\s*(?:\/|of)\s*(\d+)\s*(?:block|sector|key)s?/i);
  const current =
    attack.progress?.current ?? (unitMatch ? Number(unitMatch[1]) : previous?.current);
  const total = attack.progress?.total ?? (unitMatch ? Number(unitMatch[2]) : previous?.total);
  const percent = percentMatch
    ? boundedPercent(Number(percentMatch[1]))
    : (attack.progress?.percent ??
      (unitMatch && total && total > 0
        ? boundedPercent((Number(unitMatch[1]) / total) * 100)
        : previous?.percent));
  const phase = attack.progress?.phase ?? inferPhase(command, line) ?? previous?.phase;
  const resultKind = attack.resultKind ?? inferResult(line);

  const progress =
    phase || percent != null || current != null || total != null
      ? { ...previous, ...attack.progress, phase, percent, current, total, detail: line }
      : undefined;

  return {
    progress,
    resultKind,
    resultSummary: attack.resultSummary ?? (resultKind ? line.slice(0, 240) : undefined),
    recovery: attack.recovery ?? inferRecovery(line),
  };
}

/** Apply a completed output line to a job while keeping a bounded audit tail. */
export function applyCommandOutput(job: CommandJob, line: string): CommandJob {
  const clean = cleanLine(line);
  if (!clean) return job;
  const parsed = parseCommandProgress(job.command, clean, job.progress);
  const resultKind = strongerResult(job.resultKind, parsed.resultKind);
  return {
    ...job,
    outputTail: [...job.outputTail, clean].slice(-200),
    progress: parsed.progress ?? job.progress,
    resultKind,
    resultSummary:
      parsed.resultKind && resultKind === parsed.resultKind
        ? parsed.resultSummary
        : job.resultSummary,
    recovery: parsed.recovery ?? job.recovery,
  };
}
