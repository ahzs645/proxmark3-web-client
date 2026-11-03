/**
 * BLE UART profiles the Web Bluetooth transport knows how to drive. Each one is
 * a plain byte pipe -- a characteristic the host writes and one that notifies
 * -- so the PM3 protocol rides it unchanged.
 *
 * Web Bluetooth only exposes services named up front in `requestDevice`, so
 * unlike a native stack we cannot probe "any service with a write + notify
 * pair". Unknown bridges are covered by the custom profile from Settings.
 */
export interface BleUartProfile {
  id: "pm5-bwm" | "nus" | "hm10" | "custom";
  label: string;
  service: string;
  write: string;
  notify: string;
  namePrefix?: string;
}

export interface BleUartCustomUuids {
  service: string;
  write: string;
  notify: string;
}

const BASE_UUID_SUFFIX = "-0000-1000-8000-00805f9b34fb";

/**
 * Expands a 16-bit (`AE86`, `0xAE86`), 32-bit or 128-bit UUID, with or without
 * dashes, to the lowercase 128-bit form Web Bluetooth compares against.
 * Returns null for anything else.
 */
export function normalizeBleUuid(value: string | number): string | null {
  const raw =
    typeof value === "number"
      ? value.toString(16)
      : value.trim().toLowerCase().replace(/^0x/, "").replace(/[{}]/g, "");
  const hex = raw.replace(/-/g, "");
  if (!/^[0-9a-f]+$/.test(hex)) return null;
  if (hex.length <= 4) return `0000${hex.padStart(4, "0")}${BASE_UUID_SUFFIX}`;
  if (hex.length <= 8) return `${hex.padStart(8, "0")}${BASE_UUID_SUFFIX}`;
  if (hex.length !== 32) return null;
  if (
    raw.includes("-") &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(raw)
  ) {
    return null;
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Proxmark5 Battery/Wireless Module: one characteristic for both directions. */
export const PM5_BWM_PROFILE: BleUartProfile = {
  id: "pm5-bwm",
  label: "Proxmark5 BWM",
  service: normalizeBleUuid(0xae86)!,
  write: normalizeBleUuid(0xae88)!,
  notify: normalizeBleUuid(0xae88)!,
  namePrefix: "Proxmark5",
};

/** Nordic UART Service, used by most third-party BLE add-ons. */
export const NUS_PROFILE: BleUartProfile = {
  id: "nus",
  label: "Nordic UART",
  service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  write: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
  notify: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
};

/** HM-10 / CC2541-style serial modules: FFE0 with one FFE1 characteristic. */
export const HM10_PROFILE: BleUartProfile = {
  id: "hm10",
  label: "HM-10 serial",
  service: normalizeBleUuid(0xffe0)!,
  write: normalizeBleUuid(0xffe1)!,
  notify: normalizeBleUuid(0xffe1)!,
};

export const BUILTIN_BLE_UART_PROFILES: readonly BleUartProfile[] = [
  PM5_BWM_PROFILE,
  NUS_PROFILE,
  HM10_PROFILE,
];

/**
 * Validates the Settings UUIDs. All blank means "no custom profile"; a blank
 * notify UUID reuses the write characteristic, as the PM5 and HM-10 do.
 */
export function parseCustomBleUuids(input: BleUartCustomUuids): {
  profile: BleUartProfile | null;
  error: string | null;
} {
  if (!input.service.trim() && !input.write.trim() && !input.notify.trim()) {
    return { profile: null, error: null };
  }
  const service = normalizeBleUuid(input.service);
  const write = normalizeBleUuid(input.write);
  const notify = input.notify.trim() ? normalizeBleUuid(input.notify) : write;
  if (!service) return { profile: null, error: "Service UUID is not a valid UUID" };
  if (!write) return { profile: null, error: "Write characteristic UUID is not a valid UUID" };
  if (!notify) return { profile: null, error: "Notify characteristic UUID is not a valid UUID" };
  return {
    profile: { id: "custom", label: "Custom UART", service, write, notify },
    error: null,
  };
}

/** Profiles to offer, custom first so it wins over a built-in on the same device. */
export function bleUartProfiles(custom: BleUartCustomUuids | null): BleUartProfile[] {
  const parsed = custom ? parseCustomBleUuids(custom).profile : null;
  return parsed ? [parsed, ...BUILTIN_BLE_UART_PROFILES] : [...BUILTIN_BLE_UART_PROFILES];
}

/** `requestDevice` options that let the picker show every supported bridge. */
export function bleRequestOptions(
  profiles: readonly BleUartProfile[],
  extraServices: readonly BluetoothServiceUUID[] = [],
): RequestDeviceOptions {
  const services = [...new Set(profiles.map((profile) => profile.service))];
  const filters: BluetoothLEScanFilter[] = services.map((service) => ({ services: [service] }));
  for (const profile of profiles) {
    if (profile.namePrefix) filters.push({ namePrefix: profile.namePrefix });
  }
  return { filters, optionalServices: [...services, ...extraServices] };
}
