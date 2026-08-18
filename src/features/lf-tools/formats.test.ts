import { describe, expect, test } from "vite-plus/test";
import { buildRegisteredLfClone, LF_FORMATS_BY_TECH, parseRegisteredLfCredential } from "./formats";

const fixtures = [
  {
    tech: "awid" as const,
    output:
      "[+] AWID - len: 26 FC: 50 Card: 1234 - Wiegand: 26409a4, Raw: 011DB2881474411111111111",
    command: "lf awid clone --fmt 26 --fc 50 --cn 1234",
  },
  {
    tech: "ioprox" as const,
    output: "[+] IO Prox - XSF(01)65:01337, Raw: 007859603059CDAF",
    command: "lf io clone --vn 1 --fc 101 --cn 1337",
  },
  {
    tech: "fdxb" as const,
    output:
      "[+] FDX-B / ISO 11784/11785 - Animal\n[+] Animal ID......... 999-123456789012\n[+] National Code..... 123456789012",
    command: "lf fdxb clone --country 999 --national 123456789012",
  },
  {
    tech: "paradox" as const,
    output: "[+] Paradox - FC: 96 Card: 40426 Raw: 0F0A00009E3A",
    command: "lf paradox clone --fc 96 --cn 40426",
  },
  {
    tech: "keri" as const,
    output: "[+] KERI\n[+] Descrambled MS - FC: 1 Card: 12544",
    command: "lf keri clone -t m --fc 1 --cn 12544",
  },
  {
    tech: "pyramid" as const,
    output: "[+] Pyramid - len: 26, FC: 123, Card: 4567, Raw: AABBCCDD",
    command: "lf pyramid clone --fc 123 --cn 4567",
  },
  {
    tech: "indala" as const,
    output: "[+] Indala - Raw: A0000000A0000000",
    command: "lf indala clone --raw A0000000A0000000",
  },
];

describe("LF format capability registry", () => {
  test.each(fixtures)("parses and builds $tech fixtures", ({ tech, output, command }) => {
    const credential = parseRegisteredLfCredential(output);
    expect(credential?.tech).toBe(tech);
    expect(buildRegisteredLfClone(credential!)).toBe(command);
  });

  test("every requested format declares its safety capabilities", () => {
    for (const tech of [
      "awid",
      "ioprox",
      "fdxb",
      "paradox",
      "keri",
      "pyramid",
      "indala",
    ] as const) {
      const capability = LF_FORMATS_BY_TECH.get(tech);
      expect(capability?.readerCommand).toMatch(/^lf /);
      expect(capability?.compatibleBlanks).toContain("t55xx");
      expect(capability?.editableFields.length).toBeGreaterThan(0);
      expect(capability?.verificationFields.length).toBeGreaterThan(1);
      expect(capability?.buildSimulation).toBeTypeOf("function");
    }
  });
});
