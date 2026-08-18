import { describe, expect, test } from "vite-plus/test";
import { combineNativePm3Output } from "./nativePm3";

describe("native PM3 output", () => {
  test("keeps stdout before diagnostic stderr", () => {
    expect(
      combineNativePm3Output({
        success: false,
        stdout: "[+] UID: 01 02 03 04\n",
        stderr: "[-] device disconnected\n",
        exitCode: 1,
      }),
    ).toBe("[+] UID: 01 02 03 04\n[-] device disconnected");
  });
});
