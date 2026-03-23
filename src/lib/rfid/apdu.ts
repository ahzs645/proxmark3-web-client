import { sanitizeHex, toHexByte } from "./hex";

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
