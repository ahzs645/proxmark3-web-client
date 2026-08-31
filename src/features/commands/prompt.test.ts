import { describe, expect, test } from "vite-plus/test";
import { isPromptLine, summarizeOutputLine } from "./prompt";

describe("pm3 prompt detection", () => {
  test("recognises Proxmark3 prompts in every connection mode", () => {
    expect(isPromptLine("[usb] pm3 --> ")).toBe(true);
    expect(isPromptLine("[offline] pm3 --> ")).toBe(true);
    expect(isPromptLine("[fpc] pm3 -->")).toBe(true);
    expect(isPromptLine("pm3 --> ")).toBe(true);
    expect(isPromptLine("\x1b[1;31m[usb]\x1b[0m pm3 --> ")).toBe(true);
  });

  test("recognises the Proxmark5 prompt (observed on real hardware)", () => {
    expect(isPromptLine("[usb] pm5 --> ")).toBe(true);
    expect(isPromptLine("[usb|script] pm5 --> hw version")).toBe(true);
  });

  test("ignores ordinary output mentioning pm3", () => {
    expect(isPromptLine("[+] Communicating with PM3 over USB-CDC")).toBe(false);
    expect(isPromptLine("Please flash the Proxmark3 with a version matching the client.")).toBe(
      false,
    );
    expect(isPromptLine("pm4 -->")).toBe(false);
  });

  test("summarises output lines without severity markers", () => {
    expect(summarizeOutputLine("[+]   Max frame size:   624 bytes\r")).toBe(
      "Max frame size: 624 bytes",
    );
  });
});
