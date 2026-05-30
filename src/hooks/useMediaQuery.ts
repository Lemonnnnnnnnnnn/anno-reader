/**
 * Reusable media query hook.
 * Returns whether a CSS media query currently matches.
 * Defaults to false on first render, updates after mount.
 */

import { useState, useEffect } from "react";

export const LG_BREAKPOINT = "(min-width: 1024px)";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    function onChange(e: MediaQueryListEvent) {
      setMatches(e.matches);
    }

    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
