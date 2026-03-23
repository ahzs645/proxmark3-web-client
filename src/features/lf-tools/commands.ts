import type { ChipType, LFConfig } from "./types";

export const CHIP_TYPES: Record<ChipType, { label: string; flag: string }> = {
  t55x7: { label: "T55x7", flag: "1" },
  t5555: { label: "T5555", flag: "0" },
};

export const CLOCK_RATES = [16, 32, 40, 50, 64];

export const DEFAULT_PASSWORDS = [
  "00000000",
  "51243648",
  "20206666",
  "50524F58",
  "AA55BBBB",
  "A0A1A2A3",
  "5A5A5A5A",
  "31415926",
];

export const DEFAULT_LF_CONFIG: LFConfig = {
  divisor: 95,
  bitsPerSample: 8,
  decimation: 1,
  averaging: true,
  triggerThreshold: 0,
  samplesToSkip: 0,
};

export const FREQUENCY_PRESETS = [
  { label: "125 kHz", divisor: 95 },
  { label: "134 kHz", divisor: 88 },
];

export function clampDivisor(value: number): number {
  return Math.max(19, Math.min(255, value));
}

export function divisorToFreq(divisor: number): number {
  return 12000 / (divisor + 1);
}

export function validateEM410xId(id: string): boolean {
  const clean = id.replace(/\s/g, "").toUpperCase();
  return /^[0-9A-F]{10}$/.test(clean);
}

function sanitizeHex(value: string, maxLength: number): string {
  return value
    .toUpperCase()
    .replace(/[^A-F0-9]/gi, "")
    .slice(0, maxLength);
}

export function sanitizeHexInput(value: string, maxLength: number): string {
  return sanitizeHex(value, maxLength);
}

export function buildEm410xCloneCommand(id: string): string | null {
  const clean = sanitizeHex(id, 10);
  if (!validateEM410xId(clean)) return null;
  return `lf em 410x clone --id ${clean}`;
}

export function buildT55xxDetectCommand(usePassword: boolean, password: string): string {
  return usePassword ? `lf t55xx detect -p ${password}` : "lf t55xx detect";
}

export function buildT55xxDumpCommand(usePassword: boolean, password: string): string {
  return usePassword ? `lf t55xx dump -p ${password}` : "lf t55xx dump";
}

export function buildT55xxReadBlockCommand(
  blockNumber: string,
  usePassword: boolean,
  password: string,
): string {
  return usePassword
    ? `lf t55xx read -b ${blockNumber} -p ${password}`
    : `lf t55xx read -b ${blockNumber}`;
}

export function buildT55xxWriteBlockCommand(
  blockNumber: string,
  blockData: string,
  usePassword: boolean,
  password: string,
): string | null {
  if (blockData.length !== 8) return null;

  return usePassword
    ? `lf t55xx write -b ${blockNumber} -d ${blockData} -p ${password}`
    : `lf t55xx write -b ${blockNumber} -d ${blockData}`;
}

export function buildT55xxWipeCommand(usePassword: boolean, password: string): string {
  return usePassword ? `lf t55xx wipe -p ${password}` : "lf t55xx wipe";
}

export function buildLfConfigCommand(config: LFConfig): string {
  return `lf config -d ${config.divisor} -b ${config.bitsPerSample} -c ${config.decimation} -a ${
    config.averaging ? 1 : 0
  } -t ${config.triggerThreshold} -s ${config.samplesToSkip}`;
}

export function buildSetLfDivisorCommand(divisor: number): string {
  return `hw setlfdivisor ${divisor}`;
}

export function buildLfTuneCommand(divisor: number): string {
  return `hw tune --lf --divisor ${divisor}`;
}

export function buildLfReadCommand(samples: string): string {
  return `lf read -s ${samples}`;
}

export function buildLfSniffCommand(samples: string): string {
  return `lf sniff -s ${samples}`;
}
