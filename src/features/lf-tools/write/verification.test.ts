import { describe, expect, it } from "vite-plus/test";
import { validateLfBlank, verifyLfCredential } from "./verification";

const DETECTED_T55X7 = `
[+] Chip type......... T55x7
[+] Block0............ 00107060
[+] Password set...... No
`;

describe("verified LF writes", () => {
  it("accepts a writable carrier and warns when it already contains data", () => {
    const result = validateLfBlank(
      DETECTED_T55X7,
      "[+] EM 410x ID 0102030405\n[+] EM410x pattern found",
    );

    expect(result.ready).toBe(true);
    expect(result.existingCredential?.raw).toBe("0102030405");
    expect(result.checks.find((item) => item.id === "existing-data")?.state).toBe("warning");
  });

  it("blocks a password-protected carrier", () => {
    const result = validateLfBlank(
      DETECTED_T55X7.replace("Password set...... No", "Password set...... Yes"),
      "[-] No known 125/134 kHz tags found!",
    );

    expect(result.ready).toBe(false);
    expect(result.checks.find((item) => item.id === "password")?.state).toBe("error");
  });

  it("verifies HID fields structurally", () => {
    const result = verifyLfCredential(
      {
        tech: "hid",
        format: "H10301",
        facilityCode: 200,
        cardNumber: 46285,
        name: "source",
      },
      `
[+] [H10301] HID H10301 26-bit FC: 200 CN: 46285 parity ( ok )
[=] raw: 00000000000000200591699b
[+] Valid HID Prox ID found!
`,
    );

    expect(result.passed).toBe(true);
    expect(result.checks.every((item) => item.state === "ok")).toBe(true);
  });

  it("reports the exact field that differs", () => {
    const result = verifyLfCredential(
      {
        tech: "hid",
        format: "H10301",
        facilityCode: 200,
        cardNumber: 46285,
        name: "source",
      },
      "[+] [H10301] HID H10301 26-bit FC: 200 CN: 46286\n[+] Valid HID Prox ID found!",
    );

    expect(result.passed).toBe(false);
    expect(result.summary).toContain("Card number");
    expect(result.checks.find((item) => item.id === "card-number")?.detail).toContain("46286");
  });

  it("compares EM410x raw IDs", () => {
    const result = verifyLfCredential(
      { tech: "em410x", raw: "0102030405", name: "source" },
      "[+] EM 410x ID 0102030405\n[+] EM410x pattern found",
    );

    expect(result.passed).toBe(true);
  });
});
