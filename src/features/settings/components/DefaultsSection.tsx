import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key } from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./SettingsSection";

interface DefaultsSectionProps {
  defaultCardType: "1k" | "4k";
  defaultAuthKey: string;
  onDefaultCardTypeChange: (value: "1k" | "4k") => void;
  onDefaultAuthKeyChange: (value: string) => void;
}

export function DefaultsSection({
  defaultCardType,
  defaultAuthKey,
  onDefaultCardTypeChange,
  onDefaultAuthKeyChange,
}: DefaultsSectionProps) {
  return (
    <SettingsSection icon={<Key className="h-3 w-3" />} title="Default Values">
      <div className="space-y-2">
        <label className="text-sm font-medium">Default Card Type</label>
        <div className="flex w-fit overflow-hidden rounded-md border">
          <Button
            size="sm"
            variant={defaultCardType === "1k" ? "default" : "ghost"}
            onClick={() => onDefaultCardTypeChange("1k")}
            className="h-8 rounded-none"
          >
            1K
          </Button>
          <Button
            size="sm"
            variant={defaultCardType === "4k" ? "default" : "ghost"}
            onClick={() => onDefaultCardTypeChange("4k")}
            className="h-8 rounded-none"
          >
            4K
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Default Authentication Key</label>
        <Input
          value={defaultAuthKey}
          onChange={(e) =>
            onDefaultAuthKeyChange(
              e.target.value
                .toUpperCase()
                .replace(/[^A-F0-9]/gi, "")
                .slice(0, 12),
            )
          }
          placeholder="FFFFFFFFFFFF"
          className={cn(
            "font-mono text-xs w-40",
            defaultAuthKey.length === 12 && "border-green-500/50",
          )}
          maxLength={12}
        />
      </div>
    </SettingsSection>
  );
}
