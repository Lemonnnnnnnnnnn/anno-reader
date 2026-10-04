import { describe, expect, it } from "vitest";
import { chapterPercentage } from "../ChapterProgressRail";

describe("chapter scroll progress", () => {
  it("uses scrollable distance rather than full document height", () => {
    expect(chapterPercentage(0, 2000, 1000)).toBe(0);
    expect(chapterPercentage(500, 2000, 1000)).toBe(50);
    expect(chapterPercentage(1000, 2000, 1000)).toBe(100);
  });
  it("handles short chapters and clamps overscroll", () => {
    expect(chapterPercentage(0, 500, 1000)).toBe(100);
    expect(chapterPercentage(-100, 2000, 1000)).toBe(0);
    expect(chapterPercentage(2000, 2000, 1000)).toBe(100);
    expect(chapterPercentage(0, 0, 0)).toBe(0);
  });
});
