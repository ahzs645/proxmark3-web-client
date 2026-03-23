export function calculateBcc(uid: string): string {
  const bytes = uid.match(/.{2}/g) || [];
  if (bytes.length < 4) return "??";

  let bcc = 0;
  for (let i = 0; i < 4; i++) {
    bcc ^= Number.parseInt(bytes[i], 16);
  }

  return bcc.toString(16).padStart(2, "0").toUpperCase();
}

export function generateRandomUid(length: 4 | 7 | 10 = 4): string {
  const bytes: string[] = [];

  for (let i = 0; i < length; i++) {
    bytes.push(
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0"),
    );
  }

  return bytes.join("").toUpperCase();
}

export function validateUid(uid: string): { valid: boolean; error?: string } {
  const clean = uid.replace(/\s/g, "").toUpperCase();

  if (!/^[0-9A-F]*$/.test(clean)) {
    return { valid: false, error: "Invalid hex characters" };
  }

  if (clean.length !== 8 && clean.length !== 14 && clean.length !== 20) {
    return { valid: false, error: "UID must be 4, 7, or 10 bytes" };
  }

  return { valid: true };
}
