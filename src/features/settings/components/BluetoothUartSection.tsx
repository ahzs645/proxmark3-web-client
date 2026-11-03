import { Bluetooth } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BUILTIN_BLE_UART_PROFILES,
  parseCustomBleUuids,
  type BleUartCustomUuids,
} from "@/lib/transports/bleUart";
import { SettingsSection } from "./SettingsSection";

interface BluetoothUartSectionProps {
  value: BleUartCustomUuids;
  onChange: (value: BleUartCustomUuids) => void;
}

const FIELDS: Array<{ key: keyof BleUartCustomUuids; label: string; placeholder: string }> = [
  { key: "service", label: "Service UUID", placeholder: "ffe0 or 6e400001-b5a3-…" },
  { key: "write", label: "Write characteristic", placeholder: "ffe1" },
  { key: "notify", label: "Notify characteristic", placeholder: "blank = same as write" },
];

export function BluetoothUartSection({ value, onChange }: BluetoothUartSectionProps) {
  const { profile, error } = parseCustomBleUuids(value);

  return (
    <SettingsSection icon={<Bluetooth className="h-3 w-3" />} title="Bluetooth UART">
      <p className="text-xs leading-relaxed text-muted-foreground">
        The Bluetooth connection recognises{" "}
        {BUILTIN_BLE_UART_PROFILES.map((builtin) => builtin.label).join(", ")} bridges. For any
        other BLE serial add-on, enter its UUIDs here; it is tried first and added to the device
        picker. 16-bit (<code className="font-mono">ffe0</code>) and full 128-bit UUIDs both work.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {FIELDS.map((field) => (
          <label key={field.key} className="space-y-1">
            <span className="text-xs font-medium">{field.label}</span>
            <Input
              value={value[field.key]}
              onChange={(e) => onChange({ ...value, [field.key]: e.target.value.trim() })}
              placeholder={field.placeholder}
              spellCheck={false}
              className={cn("font-mono text-xs", error && "border-destructive/60")}
            />
          </label>
        ))}
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : profile ? (
        <p className="text-xs text-muted-foreground">
          Custom bridge: service <span className="font-mono">{profile.service}</span>
        </p>
      ) : null}
    </SettingsSection>
  );
}
