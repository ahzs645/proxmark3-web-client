import { decodeAccessBits } from "./decode";

export function validateAccessBits(hex: string): boolean {
  return decodeAccessBits(hex).valid;
}
