import { describe, expect, it } from "vitest";
import { buildReaderOverrides } from "@/lib/css/isolation";

describe("buildReaderOverrides", () => {
  it("keeps highlight text readable in dark theme", () => {
    const css = buildReaderOverrides("dark");
    const filterIndex = css.indexOf("filter: invert(1) hue-rotate(180deg)");
    const highlightOverrideIndex = css.indexOf(".anno-highlight");

    expect(filterIndex).toBeGreaterThan(-1);
    expect(highlightOverrideIndex).toBeGreaterThan(filterIndex);
    expect(css).toContain(".epub-content");
    expect(css).toContain(".anno-highlight");
    expect(css).toContain("color: #1a1a1a !important");
  });
});
