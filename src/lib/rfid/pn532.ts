import { bytesToHex, hexToBytes, parseHexByte, toHexByte } from "./hex";

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
