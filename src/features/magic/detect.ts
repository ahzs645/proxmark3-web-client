import type { MagicCardType } from "./types";

/** Result of parsing the "Magic capabilities" line from `hf mf info`. */
export interface ParsedMagicInfo {
  isMagic: boolean;
  /** Best-guess magic generation, or "unknown" when none is detected. */
  gen: MagicCardType;
  /** The raw capability text the client reported. */
  label: string;
}

const stripAnsi = (text: string): string =>
  // eslint-disable-next-line no-control-regex
  text.replace(/\x1b\[[0-9;]*m/g, "");

/**
 * Classify a card's magic capability from `hf mf info` output.
 *
 * The Iceman client prints e.g. `[+] Magic capabilities... Gen 1a` for a
 * backdoor card, `Gen 2 / CUID` for a direct-write card, or nothing at all for
 * a normal card. Returns null when the chunk holds no capability line so the
 * caller can leave any earlier detection untouched.
 */
export function parseMagicInfo(text: string): ParsedMagicInfo | null {
  const clean = stripAnsi(text);
  const match = clean.match(/Magic capabilities[.\s]*([^\n\r]+)/i);
  if (!match) return null;

  const label = match[1].trim();
  const lower = label.toLowerCase();

  // A card with no magic backdoor prints "N/A" (or the line is absent).
  if (!label || /^n\/?a\b/.test(lower) || lower === "none") {
    return { isMagic: false, gen: "unknown", label };
  }

  let gen: MagicCardType = "unknown";
  if (/gen\s*1|gen1a|backdoor/.test(lower)) gen = "gen1a";
  else if (/gen\s*4|gdm|gtu|ultimate/.test(lower)) gen = "gen4";
  else if (/gen\s*3|apdu/.test(lower)) gen = "gen3";
  else if (/gen\s*2|cuid|fuid|ufuid|write once/.test(lower)) gen = "gen2";

  return { isMagic: gen !== "unknown", gen, label };
}
