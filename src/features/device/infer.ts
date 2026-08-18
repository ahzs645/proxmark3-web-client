import type { DeviceFeatureSet, DeviceProfile, HardwareVariant, SupportLevel } from "./types";
import { assessFirmwareHealth, mergeFirmwareHealth } from "./health";

const ANSI_ESCAPE_CHAR = String.fromCharCode(27);
const ANSI_ESCAPE_REGEX = new RegExp(
  `${ANSI_ESCAPE_CHAR}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`,
  "g",
);

const UNKNOWN_FEATURES: DeviceFeatureSet = {
  lf: "unknown",
  hf: "unknown",
  smartcard: "unknown",
  externalFlash: "unknown",
  bluetoothAddon: "unknown",
};

export function emptyDeviceProfile(): DeviceProfile {
  return {
    model: null,
    clientVersion: null,
    firmwareVersion: null,
    bootromVersion: null,
    fpgaVersion: null,
    firmwareCompatible: null,
    firmwareHealth: {
      level: "unknown",
      summary: "Firmware health is not yet established",
      issues: [],
    },
    hardwareVariant: "unknown",
    microcontroller: null,
    features: { ...UNKNOWN_FEATURES },
    supportedCommands: [],
    unsupportedCommands: [],
    evidence: [],
    observedAt: null,
  };
}

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_REGEX, "");
}

function supportFromLine(output: string, label: string): SupportLevel {
  const line = output
    .split("\n")
    .find((candidate) => candidate.toLowerCase().includes(label.toLowerCase()));
  if (!line) return "unknown";
  if (/\b(?:present|yes|enabled|available)\b/i.test(line)) return "supported";
  if (/\b(?:absent|no|disabled|unavailable|not present)\b/i.test(line)) return "unsupported";
  return "unknown";
}

function firstCapture(output: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

function versionCommit(value: string | null): string | null {
  return value?.match(/-g([0-9a-f]{7,})/i)?.[1]?.toLowerCase() ?? null;
}

function versionBase(value: string | null): string | null {
  return value?.match(/\bv(\d+\.\d+)\b/i)?.[1] ?? null;
}

/**
 * Only report a positive firmware match when the evidence is strong. Matching
 * release labels with different/unknown commits are left unknown rather than
 * encouraging a potentially unsafe flash or operation.
 */
export function compareClientAndFirmware(
  clientVersion: string | null,
  firmwareVersion: string | null,
  output = "",
): boolean | null {
  if (/capabilit(?:y|ies).*mismatch|client.*firmware.*mismatch/i.test(output)) return false;
  if (!clientVersion || !firmwareVersion) return null;
  const clientCommit = versionCommit(clientVersion);
  const firmwareCommit = versionCommit(firmwareVersion);
  if (clientCommit && firmwareCommit) return clientCommit === firmwareCommit;
  const clientBase = versionBase(clientVersion);
  const firmwareBase = versionBase(firmwareVersion);
  if (clientBase && firmwareBase && clientBase !== firmwareBase) return false;
  return null;
}

function inferVariant(
  output: string,
  microcontroller: string | null,
  features: DeviceFeatureSet,
): HardwareVariant {
  if (/AT91SAM7S256/i.test(microcontroller ?? output)) return "generic-256";
  if (features.externalFlash === "supported" && features.smartcard === "supported") {
    return features.bluetoothAddon === "supported" ? "rdv4-bt" : "rdv4";
  }
  if (/\bRDV4\b/i.test(output)) {
    return /blue|bluetooth|fpc usart/i.test(output) ? "rdv4-bt" : "rdv4";
  }
  return /proxmark3|iceman|armsrc/i.test(output) ? "generic" : "unknown";
}

function commandWasRejected(output: string): boolean {
  return /unknown command|command not found|invalid command|not implemented|PM3_ENOTIMPL/i.test(
    output,
  );
}

function appendUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

/** Merge one completed PM3 command's output into the durable device profile. */
export function inferDeviceProfile(
  previous: DeviceProfile,
  rawOutput: string,
  command?: string | null,
  observedAt = Date.now(),
): DeviceProfile {
  const output = stripAnsi(rawOutput).replace(/\r/g, "");
  if (!output.trim()) return previous;

  const clientVersion =
    firstCapture(output, [/^\s*client[\s.:]+(.+)$/im, /\[\s*Client\s*\]\s*\n\s*([^\n]+)/i]) ??
    previous.clientVersion;
  const firmwareVersion =
    firstCapture(output, [
      /^\s*(?:os|firmware)[\s.:]+(.+)$/im,
      /\[\s*(?:OS|Firmware)\s*\]\s*\n\s*([^\n]+)/i,
    ]) ?? previous.firmwareVersion;
  const bootromVersion =
    firstCapture(output, [/^\s*bootrom[\s.:]+(.+)$/im, /\[\s*Bootrom\s*\]\s*\n\s*([^\n]+)/i]) ??
    previous.bootromVersion;
  const fpgaVersion =
    firstCapture(output, [
      /^\s*(?:fpga image|fpga version|fpga release|fpga)[\s.:]+(.+)$/im,
      /\[\s*FPGA\s*\]\s*\n\s*([^\n]+)/i,
    ]) ?? previous.fpgaVersion;
  const microcontroller =
    firstCapture(output, [/^\s*(?:uC|microcontroller)[\s.:]+(.+)$/im, /\b(AT91SAM7S\d+)\b/i]) ??
    previous.microcontroller;
  const model =
    firstCapture(output, [
      /^\s*(?:device|model|board)[\s.:]+(.+)$/im,
      /\b(Proxmark3\s+(?:RDV4|Easy|Generic|X)[^\n]*)/i,
    ]) ?? previous.model;

  const nextFeature = (label: string, current: SupportLevel): SupportLevel => {
    const inferred = supportFromLine(output, label);
    return inferred === "unknown" ? current : inferred;
  };
  const hasPm3Identity = /proxmark3|iceman|armsrc|bootrom/i.test(output);
  const features: DeviceFeatureSet = {
    lf: hasPm3Identity ? "supported" : previous.features.lf,
    hf: hasPm3Identity ? "supported" : previous.features.hf,
    smartcard: nextFeature("smartcard", previous.features.smartcard),
    externalFlash: nextFeature("external flash", previous.features.externalFlash),
    bluetoothAddon: nextFeature("fpc usart", previous.features.bluetoothAddon),
  };

  let supportedCommands = previous.supportedCommands;
  let unsupportedCommands = previous.unsupportedCommands;
  const normalizedCommand = command?.trim().replace(/\s+/g, " ") ?? "";
  if (normalizedCommand) {
    if (commandWasRejected(output)) {
      unsupportedCommands = appendUnique(unsupportedCommands, normalizedCommand);
      supportedCommands = supportedCommands.filter((item) => item !== normalizedCommand);
    } else {
      supportedCommands = appendUnique(supportedCommands, normalizedCommand);
      unsupportedCommands = unsupportedCommands.filter((item) => item !== normalizedCommand);
    }
  }

  const evidenceLines = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) =>
      /client|firmware|^os[\s.:]|proxmark3|AT91SAM|external flash|smartcard|fpc usart|capabilit/i.test(
        line,
      ),
    )
    .slice(0, 20);
  const evidence = [...previous.evidence];
  for (const line of evidenceLines) {
    if (!evidence.includes(line)) evidence.push(line);
  }

  const firmwareCompatible = compareClientAndFirmware(clientVersion, firmwareVersion, output);
  const firmwareHealth = mergeFirmwareHealth(
    previous.firmwareHealth,
    assessFirmwareHealth({ firmwareCompatible, output }),
  );

  return {
    model,
    clientVersion,
    firmwareVersion,
    bootromVersion,
    fpgaVersion,
    firmwareCompatible,
    firmwareHealth,
    hardwareVariant: inferVariant(output, microcontroller, features),
    microcontroller,
    features,
    supportedCommands,
    unsupportedCommands,
    evidence: evidence.slice(-40),
    observedAt,
  };
}
