import { Moon, Sun, Monitor } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Theme } from "@/hooks/useTheme";

interface ThemeToggleProps extends React.ComponentPropsWithoutRef<typeof Button> {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export const ThemeToggle = React.forwardRef<HTMLButtonElement, ThemeToggleProps>(
  function ThemeToggle({ theme, onThemeChange, className, onClick, ...props }, ref) {
    // `onClick` is pulled out of the spread on purpose. Wrappers that clone this
    // button — a Radix TooltipTrigger with `asChild`, say — pass their own
    // handler down, and a trailing `{...props}` would silently replace ours with
    // it, leaving a button that looks fine and does nothing.
    const cycleTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      const themes: Theme[] = ["light", "dark", "system"];
      const currentIndex = themes.indexOf(theme);
      const nextIndex = (currentIndex + 1) % themes.length;
      onThemeChange(themes[nextIndex]);
    };

    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8", className)}
        aria-label={`Theme: ${theme}. Click to cycle.`}
        {...props}
        onClick={cycleTheme}
      >
        {theme === "light" && <Sun className="h-4 w-4" />}
        {theme === "dark" && <Moon className="h-4 w-4" />}
        {theme === "system" && <Monitor className="h-4 w-4" />}
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  },
);

export default ThemeToggle;
