import { useEffect, useRef } from "react";
import { useBookStore } from "../stores/useBookStore";

/**
 * Hook that synchronizes the Zustand `ui.theme` state to
 * `document.documentElement.classList`. Adds or removes the `dark`
 * class on `<html>` so Tailwind's `dark:` variants activate correctly.
 *
 * On mount, reads the saved theme from localStorage. If found, applies it.
 * If not found, uses the current store theme (which may have been set by
 * system preference detection elsewhere).
 */
export default function useTheme() {
  const theme = useBookStore((s) => s.ui.theme);
  const setTheme = useBookStore((s) => s.setTheme);
  const initialized = useRef(false);

  // Initialize theme from localStorage (once)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") {
      // Apply saved theme from localStorage
      if (saved !== theme) setTheme(saved);
      document.documentElement.classList.toggle("dark", saved === "dark");
    } else {
      // No saved theme — apply current store theme to DOM
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, [theme, setTheme]);

  // Sync theme changes to DOM
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
}
