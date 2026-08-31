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

  test("identifies a Proxmark5 from upstream's PM5 hw version output", () => {
    const output = `
  [ Proxmark5 ]

    MCU....... AT32F437
    Memory.... 4032 KB ( 12% used )
    Target.... PM5

  [ Client ]
    Iceman/master/v4.21611-1443-gbe7f55f72
  [ ARM ]
    bootrom: Iceman/master/v4.21611-1443-gbe7f55f72 2026-08-30 12:53:48
       os: Iceman/master/v4.21611-1443-gbe7f55f72 2026-08-30 12:53:48
  [ FPGA ]
    PM5 HF+LF image 2026-08-20
`;
    const profile = inferDeviceProfile(emptyDeviceProfile(), output, "hw version", 5);
    expect(profile.hardwareVariant).toBe("pm5");
    expect(profile.microcontroller).toBe("AT32F437");
    expect(profile.model).toBe("Proxmark5");
    expect(profile.features.hf).toBe("supported");
    expect(profile.evidence).toContain("Target.... PM5");
  });

  test("identifies a real Proxmark5 from its post-flash hw version banner", () => {
    // Captured 2026-08-31 from a Proxmark5 (AT32F435RGT7) right after flashing
    // upstream master; the model line says "PM5" and the uC line uses "--=".
    const output = `
 [ Proxmark5 ]
 [ Client ]
  Iceman/HEAD/v4.21611-1131-ge26952070-suspect 2026-08-31 06:49:40 87d441638
 [ Model ]
  Firmware.................. PM5
  External flash............ present
 [ ARM ]
  Bootrom.... Iceman/HEAD/v4.21611-1131-ge26952070-suspect 2026-08-31 06:51:18 87d441638
  OS......... Iceman/HEAD/v4.21611-1131-ge26952070-suspect 2026-08-31 06:51:24 87d441638
  Compiler... GCC 15.3.1 20260627
 [ Hardware ]
  --= uC: AT32F437
  --= Nonvolatile Program Memory Size: 1024 KB, Used: 323500 bytes (31%)
`;
    const profile = inferDeviceProfile(emptyDeviceProfile(), output, "hw version", 7);
    expect(profile.hardwareVariant).toBe("pm5");
    expect(profile.microcontroller).toBe("AT32F437");
    expect(profile.model).toBe("Proxmark5");
    expect(profile.features.externalFlash).toBe("supported");
    expect(profile.firmwareCompatible).toBe(true);
  });

  test("does not mistake a Proxmark5 with flash/smartcard style capabilities for an RDV4", () => {
    const output = `
uC......... AT32F437
External flash................ present
Smartcard reader.............. present
Target.... PM5
`;
    const profile = inferDeviceProfile(emptyDeviceProfile(), output, "hw status", 6);
    expect(profile.hardwareVariant).toBe("pm5");
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
