/**
 * Last-used highlight color preference.
 *
 * Highlights are created with one click using the most recently chosen
 * color, so the palette only appears when recoloring an existing highlight.
 * Stored in localStorage (per-device preference, like the theme) and
 * validated against the palette so a stale value falls back to the default.
 */

import { HIGHLIGHT_COLORS } from "./constants";

const STORAGE_KEY = "last-highlight-color";
const DEFAULT_COLOR = HIGHLIGHT_COLORS[0].value;

/** The color the next highlight should use. */
export function getLastHighlightColor(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && HIGHLIGHT_COLORS.some((c) => c.value === stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable — fall through to the default.
  }
  return DEFAULT_COLOR;
}

/** Remember a color as the one to use for future highlights. */
export function setLastHighlightColor(color: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, color);
  } catch {
    // Non-fatal: the next highlight just falls back to the default.
  }
}
