import { describe, expect, test } from "vite-plus/test";
import {
  bleRequestOptions,
  bleUartProfiles,
  normalizeBleUuid,
  NUS_PROFILE,
  parseCustomBleUuids,
  PM5_BWM_PROFILE,
} from "./bleUart";

describe("normalizeBleUuid", () => {
  test("expands 16-bit and 32-bit forms onto the Bluetooth base UUID", () => {
    expect(normalizeBleUuid("AE86")).toBe("0000ae86-0000-1000-8000-00805f9b34fb");
    expect(normalizeBleUuid("0xffe1")).toBe("0000ffe1-0000-1000-8000-00805f9b34fb");
    expect(normalizeBleUuid(0xae88)).toBe("0000ae88-0000-1000-8000-00805f9b34fb");
    expect(normalizeBleUuid("12345678")).toBe("12345678-0000-1000-8000-00805f9b34fb");
  });

  test("accepts 128-bit with or without dashes", () => {
    expect(normalizeBleUuid("6E400001B5A3F393E0A9E50E24DCCA9E")).toBe(NUS_PROFILE.service);
    expect(normalizeBleUuid("{6E400001-B5A3-F393-E0A9-E50E24DCCA9E}")).toBe(NUS_PROFILE.service);
  });

  test("rejects malformed input", () => {
    expect(normalizeBleUuid("not-a-uuid")).toBeNull();
    expect(normalizeBleUuid("6e400001-b5a3-f393-e0a9")).toBeNull();
    expect(normalizeBleUuid("6e40-0001b5a3-f393-e0a9-e50e24dcca9e")).toBeNull();
  });
});

describe("custom profile", () => {
  test("blank fields mean no custom profile", () => {
    expect(parseCustomBleUuids({ service: "", write: "", notify: "" })).toEqual({
      profile: null,
      error: null,
    });
  });

  test("a blank notify UUID reuses the write characteristic", () => {
    const { profile } = parseCustomBleUuids({ service: "fff0", write: "fff1", notify: "" });
    expect(profile?.notify).toBe(profile?.write);
  });

  test("reports which field is invalid", () => {
    expect(parseCustomBleUuids({ service: "fff0", write: "zz", notify: "" }).error).toMatch(
      /Write characteristic/,
    );
  });

  test("custom profile is tried first and joins the picker filters", () => {
    const profiles = bleUartProfiles({ service: "fff0", write: "fff1", notify: "" });
    expect(profiles[0].id).toBe("custom");
    const options = bleRequestOptions(profiles, ["0000180f-0000-1000-8000-00805f9b34fb"]);
    expect(options.filters).toContainEqual({ services: ["0000fff0-0000-1000-8000-00805f9b34fb"] });
    expect(options.filters).toContainEqual({ namePrefix: PM5_BWM_PROFILE.namePrefix });
    expect(options.optionalServices).toContain(NUS_PROFILE.service);
    expect(options.optionalServices).toContain("0000180f-0000-1000-8000-00805f9b34fb");
  });
});
