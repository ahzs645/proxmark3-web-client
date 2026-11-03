/**
 * The WASM client's stdout is not a TTY, so it turns its own ANSI colours off
 * and prints bare `[+]` / `[=]` / `[!]` markers. Colour the marker the way the
 * native terminal does. This only touches what xterm displays; output parsers
 * read the stream before it gets here.
 */
const SEVERITY_COLORS: Record<string, string> = {
  "+": "\x1b[32m",
  "=": "\x1b[36m",
  "-": "\x1b[33m",
  "!": "\x1b[31m",
  "#": "\x1b[90m",
  "?": "\x1b[35m",
  "*": "\x1b[33m",
};

const RESET = "\x1b[0m";

/**
 * Returns a stateful transform for streamed output. A marker split across two
 * chunks is held back (at most `[` plus one char) until the next chunk decides
 * it, so colouring never depends on how the stream happened to be cut.
 */
export function createSeverityColorizer(): (chunk: string) => string {
  let atLineStart = true;
  let held = "";

  return (chunk: string) => {
    let input = held + chunk;
    held = "";
    let out = "";

    while (input.length > 0) {
      if (atLineStart) {
        const indent = input.match(/^[ \t]*/)?.[0] ?? "";
        const rest = input.slice(indent.length);
        if (rest.length === 0 || (rest[0] === "[" && rest.length < 3)) {
          // Not enough text yet to tell whether this is a marker.
          const partial = rest.length === 0 || rest.length === 1 || rest[1] in SEVERITY_COLORS;
          if (partial) {
            held = input;
            return out;
          }
        }
        const color = rest[0] === "[" && rest[2] === "]" ? SEVERITY_COLORS[rest[1]] : undefined;
        if (color) {
          out += `${indent}${color}${rest.slice(0, 3)}${RESET}`;
          input = rest.slice(3);
        }
        atLineStart = false;
      }

      const newline = input.search(/[\r\n]/);
      if (newline < 0) {
        out += input;
        break;
      }
      out += input.slice(0, newline + 1);
      input = input.slice(newline + 1);
      atLineStart = true;
    }
    return out;
  };
}
