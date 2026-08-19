import { useState, useEffect, useLayoutEffect, useCallback } from "react";

export type Theme = "light" | "dark" | "system";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function resolve(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/**
 * Swaps the theme class on `<html>`.
 *
 * Transitions are suppressed for the frame the swap happens in. Without that,
 * every element carrying a `transition-colors` animates to its new colour at
 * once, which reads as the theme arriving in stages rather than as one switch.
 */
function applyTheme(theme: Theme): "light" | "dark" {
  const root = document.documentElement;
  const resolved = resolve(theme);

  root.classList.add("theme-switching");
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  // Flush the swap while transitions are still off, then re-enable them.
  void root.offsetHeight;
  root.classList.remove("theme-switching");

  return resolved;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("theme") as Theme) || "dark";
  });

  // Layout effect, not effect: the class has to land before the browser paints,
  // otherwise the first frame after a switch still shows the old theme.
  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mediaQuery = window.matchMedia(DARK_QUERY);
    const handleChange = () => applyTheme("system");
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    localStorage.setItem("theme", newTheme);
    setThemeState(newTheme);
  }, []);

  return { theme, setTheme };
}

export default useTheme;
