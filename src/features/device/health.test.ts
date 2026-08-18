import { describe, expect, test } from "vite-plus/test";
import { assessFirmwareHealth } from "./health";

describe("firmware health", () => {
  test("treats a bootloader-only reader as requiring recovery", () => {
    const health = assessFirmwareHealth({
      firmwareCompatible: null,
      output: "[!] Device is in bootloader mode; no OS image found",
    });
    expect(health.level).toBe("critical");
    expect(health.issues.map((finding) => finding.code)).toContain("bootloader-only");
    expect(health.issues.map((finding) => finding.code)).toContain("firmware-image-invalid");
  });

  test("reports component mismatches with separate recovery guidance", () => {
    const health = assessFirmwareHealth({
      firmwareCompatible: false,
      output: "Bootrom mismatch: update required\nFPGA wrong version\nClient / firmware mismatch",
    });
    expect(health.level).toBe("warning");
    expect(health.issues.map((finding) => finding.code)).toEqual([
      "bootrom-outdated",
      "bootrom-mismatch",
      "fpga-mismatch",
      "client-firmware-mismatch",
    ]);
  });

  test("requires a positive compatibility observation before claiming healthy", () => {
    expect(assessFirmwareHealth({ firmwareCompatible: true, output: "" }).level).toBe("healthy");
    expect(assessFirmwareHealth({ firmwareCompatible: null, output: "" }).level).toBe("unknown");
  });
});
