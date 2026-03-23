export type HexMathOperation = "add" | "sub" | "xor" | "and" | "or" | "not";

export function toHexByte(value: number): string {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

export function parseHexByte(value: string): number | null {
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
