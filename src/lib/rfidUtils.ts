export type HexMathOperation = "add" | "sub" | "xor" | "and" | "or" | "not";

export interface ParsedApdu {
  cla: string;
  ins: string;
  p1: string;
  p2: string;
  lc: number | null;
  data: string;
  le: string | null;
}

export interface ParsedApduResponse {
  data: string;
  sw1: string;
  sw2: string;
  statusWord: string;
  description: string;
  isSuccess: boolean;
}

export interface BuiltPn532Frame {
  frameHex: string;
  payloadHex: string;
  lengthHex: string;
  lcsHex: string;
  dcsHex: string;
}

export interface VerifiedPn532Frame {
  valid: boolean;
  error?: string;
  payloadHex?: string;
  lengthHex?: string;
  lcsHex?: string;
  dcsHex?: string;
  expectedDcsHex?: string;
  hasPostamble?: boolean;
}

const APDU_STATUS_MAP: Record<string, string> = {
  "9000": "Success",
  "6300": "Authentication failed",
  "6700": "Wrong length",
  "6982": "Security status not satisfied",
  "6A82": "File not found",
  "6A86": "Incorrect P1/P2",
  "6D00": "Instruction not supported",
  "6E00": "Class not supported",
};

function toHexByte(value: number): string {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

function parseHexByte(value: string): number | null {
  const clean = sanitizeHex(value, 2);
  if (clean.length !== 2) return null;
  return Number.parseInt(clean, 16);
}

function hexToBigInt(value: string): bigint | null {
  const clean = sanitizeHex(value);
  if (!clean) return null;

  try {
    return BigInt(`0x${clean}`);
  } catch {
    return null;
  }
}

function maskForNibbleWidth(width: number): bigint {
  return (1n << BigInt(Math.max(width, 1) * 4)) - 1n;
}

export function sanitizeHex(value: string, maxLength?: number): string {
  const clean = value.toUpperCase().replace(/[^A-F0-9]/g, "");
  return typeof maxLength === "number" ? clean.slice(0, maxLength) : clean;
}

export function hexToBytes(value: string): number[] {
  const clean = sanitizeHex(value);
  const bytes: number[] = [];

  for (let i = 0; i + 1 < clean.length; i += 2) {
    bytes.push(Number.parseInt(clean.slice(i, i + 2), 16));
  }

  return bytes;
}

export function bytesToHex(bytes: ArrayLike<number>, separator = ""): string {
  return Array.from(bytes, (value) => toHexByte(value)).join(separator);
}

export function formatHex(value: string, groupSize = 2, separator = " "): string {
  const clean = sanitizeHex(value);
  if (!clean) return "";

  const groups: string[] = [];

  for (let i = 0; i < clean.length; i += groupSize) {
    groups.push(clean.slice(i, i + groupSize));
  }

  return groups.join(separator);
}

export function hexToAscii(value: string): string {
  return hexToBytes(value)
    .map((byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : "."))
    .join("");
}

export function asciiToHex(value: string): string {
  return bytesToHex(new TextEncoder().encode(value));
}

export function hexToBinary(value: string): string {
  return hexToBytes(value)
    .map((byte) => byte.toString(2).padStart(8, "0"))
    .join(" ");
}

export function reverseBytes(value: string): string {
  return bytesToHex(hexToBytes(value).reverse());
}

export function hexToDecimalString(value: string): string | null {
  const parsed = hexToBigInt(value);
  return parsed === null ? null : parsed.toString(10);
}

export function decimalToHexString(value: string, padTo = 0): string | null {
  const clean = value.trim();
  if (!clean) return null;

  try {
    const parsed = BigInt(clean);
    if (parsed < 0n) return null;
    const hex = parsed.toString(16).toUpperCase();
    return padTo > 0 ? hex.padStart(padTo, "0") : hex;
  } catch {
    return null;
  }
}

export function applyHexMath(
  left: string,
  right: string,
  operation: HexMathOperation,
): string | null {
  const a = hexToBigInt(left);
  const b = operation === "not" ? 0n : hexToBigInt(right);
  const leftWidth = Math.max(sanitizeHex(left).length, 2);
  const rightWidth = Math.max(sanitizeHex(right).length, 2);
  const width = Math.max(leftWidth, rightWidth);

  if (a === null || (operation !== "not" && b === null)) {
    return null;
  }

  let result: bigint;

  switch (operation) {
    case "add":
      result = a + (b || 0n);
      break;
    case "sub":
      result = a - (b || 0n);
      break;
    case "xor":
      result = a ^ (b || 0n);
      break;
    case "and":
      result = a & (b || 0n);
      break;
    case "or":
      result = a | (b || 0n);
      break;
    case "not":
      result = ~a & maskForNibbleWidth(width);
      break;
  }

  if (result < 0n) {
    return null;
  }

  const encoded = result.toString(16).toUpperCase();
  return operation === "not"
    ? encoded.padStart(width, "0")
    : encoded.padStart(Math.min(width, encoded.length), "0");
}

export function calculateBcc(value: string | number[]): string {
  const bytes = Array.isArray(value) ? value : hexToBytes(value);
  const target = bytes.slice(0, 4);

  if (target.length < 4) return "";

  const bcc = target.reduce((result, byte) => result ^ byte, 0);
  return toHexByte(bcc);
}

export function verifyBlock0Bcc(block0: string): {
  valid: boolean;
  expected: string;
  actual: string;
} | null {
  const clean = sanitizeHex(block0);
  if (clean.length < 10) return null;

  const expected = calculateBcc(clean.slice(0, 8));
  const actual = clean.slice(8, 10);

  return {
    valid: expected === actual,
    expected,
    actual,
  };
}

export function buildApdu(fields: {
  cla: string;
  ins: string;
  p1: string;
  p2: string;
  data?: string;
  le?: string;
}): string | null {
  const cla = sanitizeHex(fields.cla, 2).padStart(2, "0");
  const ins = sanitizeHex(fields.ins, 2).padStart(2, "0");
  const p1 = sanitizeHex(fields.p1, 2).padStart(2, "0");
  const p2 = sanitizeHex(fields.p2, 2).padStart(2, "0");
  const data = sanitizeHex(fields.data || "");
  const le = sanitizeHex(fields.le || "", 2);

  if ([cla, ins, p1, p2].some((part) => part.length !== 2)) {
    return null;
  }
  if (data.length % 2 !== 0) {
    return null;
  }
  if (fields.le && le.length !== 2) {
    return null;
  }

  const bytes = [cla, ins, p1, p2];

  if (data) {
    bytes.push(toHexByte(data.length / 2));
    bytes.push(data);
  }

  if (le) {
    bytes.push(le);
  }

  return bytes.join("").toUpperCase();
}

export function parseApdu(value: string): ParsedApdu | null {
  const clean = sanitizeHex(value);
  if (clean.length < 8 || clean.length % 2 !== 0) {
    return null;
  }

  const cla = clean.slice(0, 2);
  const ins = clean.slice(2, 4);
  const p1 = clean.slice(4, 6);
  const p2 = clean.slice(6, 8);

  if (clean.length === 8) {
    return { cla, ins, p1, p2, lc: null, data: "", le: null };
  }

  if (clean.length === 10) {
    return { cla, ins, p1, p2, lc: null, data: "", le: clean.slice(8, 10) };
  }

  const lc = Number.parseInt(clean.slice(8, 10), 16);
  const dataStart = 10;
  const dataEnd = dataStart + lc * 2;

  if (dataEnd > clean.length) {
    return null;
  }

  const data = clean.slice(dataStart, dataEnd);
  const remainder = clean.slice(dataEnd);

  if (remainder.length !== 0 && remainder.length !== 2) {
    return null;
  }

  return {
    cla,
    ins,
    p1,
    p2,
    lc,
    data,
    le: remainder || null,
  };
}

export function parseApduResponse(value: string): ParsedApduResponse | null {
  const clean = sanitizeHex(value);
  if (clean.length < 4 || clean.length % 2 !== 0) {
    return null;
  }

  const sw1 = clean.slice(clean.length - 4, clean.length - 2);
  const sw2 = clean.slice(clean.length - 2);
  const statusWord = `${sw1}${sw2}`;

  return {
    data: clean.slice(0, -4),
    sw1,
    sw2,
    statusWord,
    description: APDU_STATUS_MAP[statusWord] || `Status ${statusWord}`,
    isSuccess: statusWord === "9000",
  };
}

export function buildPn532Frame(tfi: string, data: string): BuiltPn532Frame | null {
  const tfiByte = parseHexByte(tfi);
  const dataBytes = hexToBytes(data);

  if (tfiByte === null) {
    return null;
  }

  const payload = [tfiByte, ...dataBytes];
  const length = payload.length;
  const lcs = (~length + 1) & 0xff;
  const dcs = (~payload.reduce((sum, byte) => sum + byte, 0) + 1) & 0xff;
  const frame = [0x00, 0x00, 0xff, length, lcs, ...payload, dcs, 0x00];

  return {
    frameHex: bytesToHex(frame),
    payloadHex: bytesToHex(payload),
    lengthHex: toHexByte(length),
    lcsHex: toHexByte(lcs),
    dcsHex: toHexByte(dcs),
  };
}

export function verifyPn532Frame(value: string): VerifiedPn532Frame {
  const bytes = hexToBytes(value);
  const startIndex = bytes.findIndex(
    (_, index) =>
      index + 5 < bytes.length &&
      bytes[index] === 0x00 &&
      bytes[index + 1] === 0x00 &&
      bytes[index + 2] === 0xff,
  );

  if (startIndex < 0) {
    return { valid: false, error: "Frame must contain 00 00 FF preamble" };
  }

  const length = bytes[startIndex + 3];
  const lcs = bytes[startIndex + 4];
  const payloadStart = startIndex + 5;
  const payloadEnd = payloadStart + length;
  const dcsIndex = payloadEnd;
  const postambleIndex = dcsIndex + 1;

  if (postambleIndex >= bytes.length) {
    return { valid: false, error: "Frame is truncated" };
  }

  const payload = bytes.slice(payloadStart, payloadEnd);
  const dcs = bytes[dcsIndex];
  const postamble = bytes[postambleIndex];
  const expectedDcs = (~payload.reduce((sum, byte) => sum + byte, 0) + 1) & 0xff;
  const validLength = ((length + lcs) & 0xff) === 0;
  const validDcs = expectedDcs === dcs;
  const validPostamble = postamble === 0x00;

  return {
    valid: validLength && validDcs && validPostamble,
    error:
      validLength && validDcs && validPostamble
        ? undefined
        : !validLength
          ? "Invalid LEN/LCS checksum"
          : !validDcs
            ? "Invalid payload checksum"
            : "Missing 00 postamble",
    payloadHex: bytesToHex(payload),
    lengthHex: toHexByte(length),
    lcsHex: toHexByte(lcs),
    dcsHex: toHexByte(dcs),
    expectedDcsHex: toHexByte(expectedDcs),
    hasPostamble: validPostamble,
  };
}

export const DEFAULT_MIFARE_KEYS = [
  "FFFFFFFFFFFF",
  "A0A1A2A3A4A5",
  "D3F7D3F7D3F7",
  "000000000000",
  "B0B1B2B3B4B5",
  "4D3A99C351DD",
  "1A982C7E459A",
  "AABBCCDDEEFF",
  "714C5C886E97",
  "587EE5F9350F",
  "A0478CC39091",
  "533CB6C723F6",
  "8FD0A4F256E9",
];
