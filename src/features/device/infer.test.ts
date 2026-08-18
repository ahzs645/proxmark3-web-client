import { describe, expect, test } from "vite-plus/test";
import { compareClientAndFirmware, emptyDeviceProfile, inferDeviceProfile } from "./infer";

describe("device capability inference", () => {
  test("infers RDV4 Bluetooth hardware from observed features", () => {
    const output = `
[ Client ]
Iceman/master/v4.20728-358-ga2ba91043
OS......... Iceman/master/v4.20728-358-ga2ba91043
uC......... AT91SAM7S512 Rev A
External flash................ present
Smartcard reader.............. present
FPC USART..................... present
Proxmark3 RDV4
`;
    const profile = inferDeviceProfile(emptyDeviceProfile(), output, "hw version", 123);
    expect(profile.hardwareVariant).toBe("rdv4-bt");
    expect(profile.firmwareCompatible).toBe(true);
    expect(profile.firmwareHealth.level).toBe("healthy");
    expect(profile.features.externalFlash).toBe("supported");
    expect(profile.supportedCommands).toContain("hw version");
    expect(profile.observedAt).toBe(123);
  });

  test("captures bootrom and FPGA versions plus health findings", () => {
    const profile = inferDeviceProfile(
      emptyDeviceProfile(),
      "Bootrom.... Iceman/v4.20000\nFPGA release.... 2025.01\nFPGA mismatch: wrong version",
      "hw status",
      2,
    );
    expect(profile.bootromVersion).toBe("Iceman/v4.20000");
    expect(profile.fpgaVersion).toBe("2025.01");
    expect(profile.firmwareHealth.level).toBe("warning");
    expect(profile.firmwareHealth.issues[0]?.code).toBe("fpga-mismatch");
  });

  test("keeps same-base versions unknown when commits cannot be compared", () => {
    expect(compareClientAndFirmware("Iceman/master/v4.20728", "Iceman/master/v4.20728")).toBeNull();
  });

  test("records rejected commands without assuming other features are absent", () => {
    const profile = inferDeviceProfile(
      emptyDeviceProfile(),
      "[!!] Unknown command: hf fancy future-command",
      "hf fancy future-command",
      1,
    );
    expect(profile.unsupportedCommands).toEqual(["hf fancy future-command"]);
    expect(profile.features.hf).toBe("unknown");
  });
});
