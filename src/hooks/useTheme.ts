import { useEffect } from "react";
import { useBookStore } from "../stores/useBookStore";

/**
 * Hook that synchronizes the Zustand `ui.theme` state to
 * `document.documentElement.classList`. Adds or removes the `dark`
 * class on `<html>` so Tailwind's `dark:` variants activate correctly.
 */
export default function useTheme() {
  const theme = useBookStore((s) => s.ui.theme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
}
