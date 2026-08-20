/**
 * Output helpers that make simulated lines look like the real pm3 client:
 * the `[+]/[=]/[-]` severity markers and the ANSI colours the terminal already
 * knows how to render. Kept tiny and dependency-free so command handlers read
 * as almost-literal transcripts.
 */

const ESC = String.fromCharCode(27);
export const RESET = `${ESC}[0m`;

export function green(text: string): string {
  return `${ESC}[32m${text}${RESET}`;
}
export function yellow(text: string): string {
  return `${ESC}[33m${text}${RESET}`;
}
export function cyan(text: string): string {
  return `${ESC}[36m${text}${RESET}`;
}
export function red(text: string): string {
  return `${ESC}[31m${text}${RESET}`;
}
export function dim(text: string): string {
  return `${ESC}[90m${text}${RESET}`;
}

/** `[+]` success marker. */
export function ok(text: string): string {
  return `${green("[+]")} ${text}`;
}
/** `[=]` informational marker. */
export function info(text: string): string {
  return `${cyan("[=]")} ${text}`;
}
/** `[-]` failure marker. */
export function fail(text: string): string {
  return `${red("[-]")} ${text}`;
}
/** `[!]` warning marker. */
export function warn(text: string): string {
  return `${yellow("[!]")} ${text}`;
}

/** The interactive prompt. Emitting it tells the app a command finished. */
export function prompt(): string {
  return dim("[sim] pm3 --> ");
}
