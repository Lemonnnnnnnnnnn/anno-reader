import { describe, expect, it } from "vitest";
import { buildReaderOverrides } from "@/lib/css/isolation";

describe("buildReaderOverrides", () => {
  it("keeps highlight text readable in dark theme", () => {
    const css = buildReaderOverrides("dark");
    const textOverrideIndex = css.indexOf("span, a, li, td, th, div");
    const highlightOverrideIndex = css.indexOf(".anno-highlight");

    expect(textOverrideIndex).toBeGreaterThan(-1);
    expect(highlightOverrideIndex).toBeGreaterThan(textOverrideIndex);
    expect(css).toContain("color: #e5e5e5 !important");
    expect(css).toContain(".anno-highlight");
    expect(css).toContain("color: #1a1a1a !important");
  });
});
