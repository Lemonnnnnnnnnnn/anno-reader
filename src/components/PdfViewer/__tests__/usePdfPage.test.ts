/**
 * Tests for usePdfPage dark-mode color decision.
 *
 * getPdfPageColors drives the pdf.js `pageColors` render option: dark
 * mode swaps the page background/foreground at render time (the official
 * pdf.js dark-mode mechanism), light mode renders original colors.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import { getPdfPageColors } from "../hooks/usePdfPage";

describe("getPdfPageColors", () => {
  it("returns null in light mode (original colors)", () => {
    expect(getPdfPageColors("light")).toBeNull();
  });

  it("returns dark background/foreground in dark mode", () => {
    expect(getPdfPageColors("dark")).toEqual({
      background: "#1a1a1a",
      foreground: "#e5e5e5",
    });
  });
});
