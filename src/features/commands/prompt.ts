const ANSI_ESCAPE_CHAR = String.fromCharCode(27);
const ANSI_ESCAPE_REGEX = new RegExp(
  `${ANSI_ESCAPE_CHAR}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`,
  "g",
);

/** Strip ANSI colour/movement escapes so text can be matched on. */
export function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_REGEX, "");
}

// The pm3 client prints its prompt whenever it is ready for the next command:
// `[usb] pm3 --> `, `[offline] pm3 --> `, `[fpc] pm3 --> `, and the bare
// `pm3 --> ` some builds emit. Seeing it is how we know a command finished —
// the WASM client has no completion callback for the stdin path.
const PROMPT_REGEX = /(?:^|\s)(?:\[[a-z0-9 _-]{1,12}\]\s*)?pm3\s*-->/i;

/** True when a line of pm3 output is (or ends with) the interactive prompt. */
export function isPromptLine(line: string): boolean {
  return PROMPT_REGEX.test(stripAnsi(line));
}

/**
 * Condense a raw output line into something worth showing in the activity bar:
 * ANSI stripped, pm3's `[+]`/`[=]` severity markers dropped, whitespace tidied.
 */
export function summarizeOutputLine(line: string): string {
  return stripAnsi(line)
    .replace(/\r/g, "")
    .replace(/^\s*\[[-+=!?#*]\]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}
