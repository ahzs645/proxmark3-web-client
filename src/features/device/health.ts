export type FirmwareHealthLevel = "healthy" | "warning" | "critical" | "unknown";

export type FirmwareHealthIssueCode =
  | "client-firmware-mismatch"
  | "bootrom-outdated"
  | "bootrom-mismatch"
  | "bootloader-only"
  | "firmware-image-invalid"
  | "fpga-unavailable"
  | "fpga-mismatch";

export interface FirmwareHealthIssue {
  code: FirmwareHealthIssueCode;
  level: Exclude<FirmwareHealthLevel, "healthy" | "unknown">;
  summary: string;
  action: string;
  evidence: string;
}

export interface FirmwareHealth {
  level: FirmwareHealthLevel;
  summary: string;
  issues: FirmwareHealthIssue[];
}

interface FirmwareHealthInput {
  firmwareCompatible: boolean | null;
  output: string;
}

function evidenceLine(output: string, pattern: RegExp): string {
  return (
    output
      .split("\n")
      .map((line) => line.trim())
      .find((line) => pattern.test(line)) ?? "Observed in PM3 output"
  );
}

function issue(
  output: string,
  code: FirmwareHealthIssueCode,
  level: FirmwareHealthIssue["level"],
  pattern: RegExp,
  summary: string,
  action: string,
): FirmwareHealthIssue | null {
  if (!pattern.test(output)) return null;
  return { code, level, summary, action, evidence: evidenceLine(output, pattern) };
}

export function assessFirmwareHealth({
  firmwareCompatible,
  output,
}: FirmwareHealthInput): FirmwareHealth {
  const candidates = [
    issue(
      output,
      "bootloader-only",
      "critical",
      /(?:bootloader|bootrom)\s+mode|device is in bootloader|no os image/i,
      "Reader is running in bootloader mode",
      "Do not run card operations. Reflash a platform-matched full image, then verify the reader boots normally.",
    ),
    issue(
      output,
      "firmware-image-invalid",
      "critical",
      /(?:no\s+os image|(?:firmware|fullimage|os image).*(?:corrupt|invalid|bad checksum|not found|missing))/i,
      "The firmware image appears invalid or missing",
      "Enter bootloader recovery and flash a checksum-verified image for the detected hardware platform.",
    ),
    issue(
      output,
      "bootrom-outdated",
      "warning",
      /bootrom.*(?:outdated|too old|update required|needs? (?:an )?update)/i,
      "Bootrom update is recommended",
      "Inspect the reader in Settings and update bootrom and full image as one verified package.",
    ),
    issue(
      output,
      "bootrom-mismatch",
      "warning",
      /bootrom.*(?:mismatch|incompatible|does not match)/i,
      "Bootrom and firmware do not match",
      "Avoid destructive operations until bootrom and full image are updated from the same compatible package.",
    ),
    issue(
      output,
      "fpga-unavailable",
      "critical",
      /fpga.*(?:not found|not loaded|load failed|unavailable|invalid image)/i,
      "FPGA image is unavailable",
      "Power-cycle once, then verify or reflash the full firmware image before using RF commands.",
    ),
    issue(
      output,
      "fpga-mismatch",
      "warning",
      /fpga.*(?:mismatch|incompatible|wrong version)/i,
      "FPGA and firmware versions do not match",
      "Use a complete platform-matched firmware package so the OS and FPGA image come from the same build.",
    ),
  ].filter((candidate): candidate is FirmwareHealthIssue => candidate !== null);

  if (
    firmwareCompatible === false &&
    !candidates.some((item) => item.code === "client-firmware-mismatch")
  ) {
    candidates.push({
      code: "client-firmware-mismatch",
      level: "warning",
      summary: "Client and firmware builds do not match",
      action:
        "Use a PM3 client built from the same release/commit as the reader firmware before destructive operations.",
      evidence: evidenceLine(output, /client|firmware|\bos[\s.:]/i),
    });
  }

  const level: FirmwareHealthLevel = candidates.some((item) => item.level === "critical")
    ? "critical"
    : candidates.length > 0
      ? "warning"
      : firmwareCompatible === true
        ? "healthy"
        : "unknown";
  const summary =
    level === "critical"
      ? "Firmware recovery required"
      : level === "warning"
        ? "Firmware attention recommended"
        : level === "healthy"
          ? "Observed firmware components are compatible"
          : "Firmware health is not yet established";

  return { level, summary, issues: candidates };
}

export function mergeFirmwareHealth(
  previous: FirmwareHealth,
  observed: FirmwareHealth,
): FirmwareHealth {
  if (observed.level === "unknown") return previous;
  if (observed.level === "healthy") return observed;
  const issues = [...previous.issues];
  for (const finding of observed.issues) {
    const index = issues.findIndex((candidate) => candidate.code === finding.code);
    if (index >= 0) issues[index] = finding;
    else issues.push(finding);
  }
  const level = issues.some((finding) => finding.level === "critical") ? "critical" : "warning";
  return {
    level,
    summary: level === "critical" ? "Firmware recovery required" : "Firmware attention recommended",
    issues,
  };
}
