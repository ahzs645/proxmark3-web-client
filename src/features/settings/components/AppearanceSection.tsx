import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Palette, Moon, Sun, Monitor } from "lucide-react";
import type { Theme } from "@/hooks/useTheme";
import { SettingsSection } from "./SettingsSection";

interface AppearanceSectionProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  terminalFontSize: number;
  onTerminalFontSizeChange: (value: number) => void;
}

export function AppearanceSection({
  theme,
  onThemeChange,
  terminalFontSize,
  onTerminalFontSizeChange,
}: AppearanceSectionProps) {
  const handleFontSizeChange = useCallback(
    (value: string) => {
      onTerminalFontSizeChange(Number.parseInt(value, 10) || 14);
    },
    [onTerminalFontSizeChange],
  );

  return (
    <SettingsSection icon={<Palette className="h-3 w-3" />} title="Appearance">
      <div className="space-y-2">
        <label className="text-sm font-medium">Theme</label>
        <div className="flex w-fit overflow-hidden rounded-md border">
          <Button
            size="sm"
            variant={theme === "light" ? "default" : "ghost"}
            onClick={() => onThemeChange("light")}
            className="h-8 rounded-none gap-1"
          >
            <Sun className="h-3 w-3" />
            Light
          </Button>
          <Button
            size="sm"
            variant={theme === "dark" ? "default" : "ghost"}
            onClick={() => onThemeChange("dark")}
            className="h-8 rounded-none gap-1"
          >
            <Moon className="h-3 w-3" />
            Dark
          </Button>
          <Button
            size="sm"
            variant={theme === "system" ? "default" : "ghost"}
            onClick={() => onThemeChange("system")}
            className="h-8 rounded-none gap-1"
          >
            <Monitor className="h-3 w-3" />
            System
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Terminal Font Size</label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={10}
            max={24}
            value={terminalFontSize}
            onChange={(e) => handleFontSizeChange(e.target.value)}
            className="h-8 w-20 text-xs"
          />
          <span className="text-xs text-muted-foreground">px</span>
        </div>
      </div>
    </SettingsSection>
  );
}
