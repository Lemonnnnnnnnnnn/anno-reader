/**
 * Tests for useBookStore updateHighlight action.
 *
 * Verifies that updateHighlight correctly updates the color of a highlight
 * by ID, and leaves other highlight properties unchanged.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useBookStore, type Highlight } from "@/stores/useBookStore";

const SAMPLE_HIGHLIGHT: Highlight = {
  id: "hl_test_1",
  bookId: "book_1",
  chapterHref: "chapter1.xhtml",
  cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,10)",
  text: "Some selected text",
  color: "#ffeb3b",
  createdAt: 1700000000000,
};

const SAMPLE_HIGHLIGHT_2: Highlight = {
  id: "hl_test_2",
  bookId: "book_1",
  chapterHref: "chapter2.xhtml",
  cfiRange: "epubcfi(/6/8[chap02]!/4/2:5,20)",
  text: "Another selection",
  color: "#4fc3f7",
  createdAt: 1700000100000,
};

describe("updateHighlight", () => {
  beforeEach(() => {
    useBookStore.setState({ highlights: [] });
  });

  it("updates the color of a highlight by id", () => {
    useBookStore.setState({ highlights: [SAMPLE_HIGHLIGHT] });

    useBookStore.getState().updateHighlight("hl_test_1", { color: "#ff5722" });

    const { highlights } = useBookStore.getState();
    expect(highlights).toHaveLength(1);
    expect(highlights[0].color).toBe("#ff5722");
  });

  it("leaves other highlight properties unchanged after color update", () => {
    useBookStore.setState({ highlights: [SAMPLE_HIGHLIGHT] });

    useBookStore.getState().updateHighlight("hl_test_1", { color: "#e91e63" });

    const { highlights } = useBookStore.getState();
    const updated = highlights[0];
    expect(updated.id).toBe(SAMPLE_HIGHLIGHT.id);
    expect(updated.bookId).toBe(SAMPLE_HIGHLIGHT.bookId);
    expect(updated.chapterHref).toBe(SAMPLE_HIGHLIGHT.chapterHref);
    expect(updated.cfiRange).toBe(SAMPLE_HIGHLIGHT.cfiRange);
    expect(updated.text).toBe(SAMPLE_HIGHLIGHT.text);
    expect(updated.createdAt).toBe(SAMPLE_HIGHLIGHT.createdAt);
    expect(updated.color).toBe("#e91e63");
  });

  it("does not modify other highlights in the array", () => {
    useBookStore.setState({ highlights: [SAMPLE_HIGHLIGHT, SAMPLE_HIGHLIGHT_2] });

    useBookStore.getState().updateHighlight("hl_test_1", { color: "#8bc34a" });

    const { highlights } = useBookStore.getState();
    expect(highlights[0].color).toBe("#8bc34a");
    expect(highlights[1]).toEqual(SAMPLE_HIGHLIGHT_2);
  });

  it("does nothing when highlight id is not found", () => {
    useBookStore.setState({ highlights: [SAMPLE_HIGHLIGHT] });

    useBookStore.getState().updateHighlight("hl_nonexistent", { color: "#ff0000" });

    const { highlights } = useBookStore.getState();
    expect(highlights).toHaveLength(1);
    expect(highlights[0].color).toBe(SAMPLE_HIGHLIGHT.color);
  });
});
