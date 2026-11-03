import { describe, expect, test } from "vite-plus/test";
import { createSeverityColorizer } from "./severity";

describe("severity colorizer", () => {
  test("colours the marker only", () => {
    const colorize = createSeverityColorizer();
    expect(colorize("[+] UID: 01 02 03 04\r\n[!] no tag\r\n")).toBe(
      "\x1b[32m[+]\x1b[0m UID: 01 02 03 04\r\n\x1b[31m[!]\x1b[0m no tag\r\n",
    );
  });

  test("keeps indentation and leaves non-marker brackets alone", () => {
    const colorize = createSeverityColorizer();
    expect(colorize("  [=] key\n[offline] pm3 --> ")).toBe(
      "  \x1b[36m[=]\x1b[0m key\n[offline] pm3 --> ",
    );
  });

  test("handles a marker split across chunks", () => {
    const colorize = createSeverityColorizer();
    expect(colorize("done\n[")).toBe("done\n");
    expect(colorize("+")).toBe("");
    expect(colorize("] ok\n")).toBe("\x1b[32m[+]\x1b[0m ok\n");
  });

  test("leaves output that is already coloured", () => {
    const colorize = createSeverityColorizer();
    const coloured = "\x1b[32m[+]\x1b[0m already\n";
    expect(colorize(coloured)).toBe(coloured);
  });

  test("only looks at line starts, including after a carriage return", () => {
    const colorize = createSeverityColorizer();
    expect(colorize("key [+] mid\r[=] 50%")).toBe("key [+] mid\r\x1b[36m[=]\x1b[0m 50%");
  });
});
