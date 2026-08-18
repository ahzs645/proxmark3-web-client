import { describe, expect, it } from "vite-plus/test";
import { lfCredentialToTagInfo, parseLfCredential, parseT55xxDetect } from "./lfParse";

const HID_SEARCH_OUTPUT = `
[+] [H10301  ] HID H10301 26-bit   FC: 200  CN: 46285  parity ( ok )
[=] raw: 00000000000000200591699b
[+] Valid HID Prox ID found!
[+] Chipset... T55xx
`;

describe("LF output parsing", () => {
  it("extracts a complete HID credential and exposes it as the active LF target", () => {
    const credential = parseLfCredential(HID_SEARCH_OUTPUT);

    expect(credential).toEqual({
      tech: "hid",
      format: "H10301",
      facilityCode: 200,
      cardNumber: 46285,
      raw: "00000000000000200591699B",
      name: "HID H10301 FC 200 CN 46285",
    });
    expect(lfCredentialToTagInfo(credential!)).toEqual({
      uid: "00000000000000200591699B",
      type: "HID H10301",
      protocol: "LF",
      subtype: "HID",
    });
  });

  it("recognizes a writable T55x7 carrier from detect output", () => {
    expect(
      parseT55xxDetect(`
[+] Chip type......... T55x7
[+] Block0............ 00107060
[+] Password set...... No
`),
    ).toEqual({
      chip: "T55x7",
      config: "00107060",
      passwordSet: false,
      writable: true,
    });
  });

  it("turns a failed carrier check into an actionable read-only result", () => {
    expect(
      parseT55xxDetect(
        "[!] Could not detect modulation automatically. Try setting it manually with 'lf t55xx config'",
      ),
    ).toEqual({
      writable: false,
      error:
        "Could not detect the card modulation. Reposition the card over the LF antenna and retry.",
    });
  });

  it("distinguishes a reader/client frame mismatch from an absent or misplaced card", () => {
    expect(
      parseT55xxDetect(`
[!] Received packet OLD frame with payload too short? 383/534
[!] Could not detect modulation automatically. Try setting it manually with 'lf t55xx config'
`),
    ).toEqual({
      writable: false,
      error:
        "A truncated serial frame blocked the LF capture. Reconnect the reader and retry; if it persists, check the WebSerial transport buffer.",
    });
  });

  it("does not create a carrier result from configuration-only output", () => {
    expect(
      parseT55xxDetect(`
[=] --- current t55xx config --------------------------
[=] Chip type......... T55x7
[=] Modulation........ FSK2a
[=] Block0............ 00107060 (auto detect)
[=] Password set...... No
`),
    ).toBeNull();
  });

  it("does not accept an incomplete standalone chip-type line", () => {
    expect(parseT55xxDetect("[=] Chip type......... T55x7")).toBeNull();
  });

  it("does not treat an unrelated LF search timeout as a carrier result", () => {
    expect(
      parseT55xxDetect(`
[-] Timed out while trying to download data from device
[-] No known 125/134 kHz tags found!
`),
    ).toBeNull();
  });
});
