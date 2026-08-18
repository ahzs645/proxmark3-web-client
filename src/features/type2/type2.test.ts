import { describe, expect, it } from "vite-plus/test";
import { buildNdefTlv, parseNdefMessage, type NdefField } from "./ndef";
import { clearNdefTlvs, extractNdefTlv, parseType2Tlvs } from "./tlv";
import {
  NTAG213,
  NTAG215,
  NTAG216,
  genericProfileFromCc,
  ndefLastPage,
  profileFromMaxPage,
} from "./profiles";

const fields: NdefField[] = [
  { id: "1", name: "Brand", value: "Example", writeName: true, kind: "text" },
  { id: "2", name: "Link", value: "https://example.com/tag", writeName: false, kind: "uri" },
];

describe("Type 2 profiles", () => {
  it("maps all known max pages and safe NDEF ranges", () => {
    expect(profileFromMaxPage(44)).toEqual(NTAG213);
    expect(profileFromMaxPage(134)).toEqual(NTAG215);
    expect(profileFromMaxPage(230)).toEqual(NTAG216);
    expect(ndefLastPage(NTAG216)).toBe(221);
  });

  it("creates read-only generic profiles from a capability container", () => {
    const profile = genericProfileFromCc(new Uint8Array([0xe1, 0x10, 0x12, 0x00]));
    expect(profile?.ndefCapacity).toBe(144);
    expect(profile?.knownLayout).toBe(false);
  });
});

describe("NDEF codec", () => {
  it("preserves Text and URI ordering", () => {
    const tlv = buildNdefTlv(fields, 496);
    const message = extractNdefTlv(tlv);
    expect(message).toBeDefined();
    const records = parseNdefMessage(message!);
    expect(records.map((record) => record.decoded)).toEqual([
      "Brand Example",
      "https://example.com/tag",
    ]);
  });

  it("rejects unsafe or oversized content", () => {
    expect(() => buildNdefTlv([{ ...fields[1], value: "ftp://example.com" }], 496)).toThrow(
      /https/,
    );
    expect(() => buildNdefTlv([{ ...fields[0], value: "x".repeat(200) }], 40)).toThrow(/capacity/);
  });
});

describe("Type 2 TLVs", () => {
  it("clears NDEF in place while preserving foreign records", () => {
    const source = new Uint8Array([0xfd, 0x02, 0xaa, 0xbb, 0x03, 0x03, 1, 2, 3, 0xfe]);
    const cleared = clearNdefTlvs(source);
    expect(cleared.changed).toBe(true);
    expect(Array.from(cleared.data.slice(0, 4))).toEqual([0xfd, 0x02, 0xaa, 0xbb]);
    expect(Array.from(cleared.data.slice(4))).toEqual([0x03, 0, 0, 0, 0, 0xfe]);
    expect(parseType2Tlvs(cleared.data)[0].type).toBe(0xfd);
  });
});
