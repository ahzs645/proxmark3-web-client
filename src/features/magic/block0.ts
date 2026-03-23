import { calculateBcc } from "./uid";

export interface Block0PreviewInput {
  uid: string;
  bcc?: string;
  calculatedBcc: string;
  sak: string;
  atqa: string;
  manufacturer: string;
}

export function buildBlock0Preview({
  uid,
  bcc,
  calculatedBcc,
  sak,
  atqa,
  manufacturer,
}: Block0PreviewInput): string {
  const paddedUid = uid.padEnd(8, "0").slice(0, 8);
  const nextBcc = bcc || calculateBcc(uid) || calculatedBcc;
  const paddedSak = sak.padStart(2, "0").slice(0, 2);
  const atqaBytes = atqa.padStart(4, "0").slice(0, 4);
  const atqaReversed = atqaBytes.slice(2, 4) + atqaBytes.slice(0, 2);
  const mfr = manufacturer.padEnd(14, "0").slice(0, 14);

  return `${paddedUid}${nextBcc}${paddedSak}${atqaReversed}${mfr}`.toUpperCase();
}
