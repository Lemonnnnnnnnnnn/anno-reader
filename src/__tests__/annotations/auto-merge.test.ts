/**
 * Tests for createHighlight auto-merge logic.
 *
 * When creating a new highlight that overlaps existing highlights,
 * createHighlight should merge all overlapping highlights into one:
 * - Delete all overlapping existing highlights
 * - Create new highlight with merged range (union of all offsets)
 * - Concatenate texts with space separator
 * - Use new highlight's color
 * - Assign a new ID (don't reuse old IDs)
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useBookStore, type Highlight } from "@/stores/useBookStore";
import { createTestHighlight } from "@/__tests__/helpers/annotation-test-helpers";

// Mock persistence module
vi.mock("@/lib/annotations/persistence", () => ({
  loadNotesFromFile: vi.fn().mockResolvedValue([]),
  saveNotesToFile: vi.fn().mockResolvedValue(undefined),
  deleteNotesFile: vi.fn().mockResolvedValue(undefined),
  loadHighlightsFromFile: vi.fn().mockResolvedValue([]),
  saveHighlightsToFile: vi.fn().mockResolvedValue(undefined),
  deleteHighlightsFile: vi.fn().mockResolvedValue(undefined),
}));

describe("createHighlight auto-merge", () => {
  beforeEach(() => {
    useBookStore.setState({ highlights: [], notes: [] });
  });

  it("creates highlight normally when no overlaps exist", async () => {
    const { createHighlight } = await import("@/lib/annotations");

    // Existing highlight: [50, 60) — no overlap with new [0, 10)
    const existing = createTestHighlight({
      cfiRange: "epubcfi(/6/4[chap01]!/4/2:50,60)",
      text: "other text",
    });
    useBookStore.setState({ highlights: [existing] });

    const result = await createHighlight(
      "book-test-1",
      "chapter1.xhtml",
      "epubcfi(/6/4[chap01]!/4/2:0,10)",
      "new text",
      "#ff0000"
    );

    const { highlights } = useBookStore.getState();
    // Original + new = 2 highlights
    expect(highlights).toHaveLength(2);
    expect(result.text).toBe("new text");
    expect(result.cfiRange).toBe("epubcfi(/6/4[chap01]!/4/2:0,10)");
  });

  it("merges two overlapping highlights into one", async () => {
    const { createHighlight } = await import("@/lib/annotations");

    // Existing: [5, 15) — overlaps with new [0, 10)
    const existing = createTestHighlight({
      cfiRange: "epubcfi(/6/4[chap01]!/4/2:5,15)",
      text: "existing text",
      color: "#ffff00",
    });
    useBookStore.setState({ highlights: [existing] });

    const result = await createHighlight(
      "book-test-1",
      "chapter1.xhtml",
      "epubcfi(/6/4[chap01]!/4/2:0,10)",
      "new text",
      "#ff0000"
    );

    const { highlights } = useBookStore.getState();
    expect(highlights).toHaveLength(1);
    // Merged range: [0, 15)
    expect(result.cfiRange).toBe("epubcfi(/6/4[chap01]!/4/2:0,15)");
    // Concatenated text
    expect(result.text).toBe("new text existing text");
    // New highlight's color wins
    expect(result.color).toBe("#ff0000");
    // New ID (not the existing one)
    expect(result.id).not.toBe(existing.id);
  });

  it("merges multiple overlapping highlights at once", async () => {
    const { createHighlight } = await import("@/lib/annotations");

    // Two existing highlights both overlapping with new [5, 15)
    const existing1 = createTestHighlight({
      cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,10)",
      text: "first",
    });
    const existing2 = createTestHighlight({
      cfiRange: "epubcfi(/6/4[chap01]!/4/2:12,20)",
      text: "second",
    });
    useBookStore.setState({ highlights: [existing1, existing2] });

    const result = await createHighlight(
      "book-test-1",
      "chapter1.xhtml",
      "epubcfi(/6/4[chap01]!/4/2:5,15)",
      "new",
      "#00ff00"
    );

    const { highlights } = useBookStore.getState();
    expect(highlights).toHaveLength(1);
    // Merged range: [0, 20)
    expect(result.cfiRange).toBe("epubcfi(/6/4[chap01]!/4/2:0,20)");
    // All texts concatenated in range order
    expect(result.text).toBe("first new second");
  });

  it("iteratively merges transitive overlaps (A↔B, B↔C, but A↮C)", async () => {
    const { createHighlight } = await import("@/lib/annotations");

    // [0, 10) and [15, 25) — don't overlap each other
    // New highlight [8, 18) overlaps both
    const existing1 = createTestHighlight({
      cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,10)",
      text: "first",
    });
    const existing2 = createTestHighlight({
      cfiRange: "epubcfi(/6/4[chap01]!/4/2:15,25)",
      text: "second",
    });
    useBookStore.setState({ highlights: [existing1, existing2] });

    const result = await createHighlight(
      "book-test-1",
      "chapter1.xhtml",
      "epubcfi(/6/4[chap01]!/4/2:8,18)",
      "new",
      "#ff0000"
    );

    const { highlights } = useBookStore.getState();
    expect(highlights).toHaveLength(1);
    // All three merged: [0, 25)
    expect(result.cfiRange).toBe("epubcfi(/6/4[chap01]!/4/2:0,25)");
    expect(result.text).toBe("first new second");
  });

  it("does not merge adjacent ranges (only true overlaps)", async () => {
    const { createHighlight } = await import("@/lib/annotations");

    // Existing: [10, 50) — adjacent to new [50, 80), NOT overlapping
    const existing = createTestHighlight({
      cfiRange: "epubcfi(/6/4[chap01]!/4/2:10,50)",
      text: "existing",
      color: "#ffff00",
    });
    useBookStore.setState({ highlights: [existing] });

    const result = await createHighlight(
      "book-test-1",
      "chapter1.xhtml",
      "epubcfi(/6/4[chap01]!/4/2:50,80)",
      "new text",
      "#ff0000"
    );

    const { highlights } = useBookStore.getState();
    // Adjacent — no merge: 2 highlights
    expect(highlights).toHaveLength(2);
    expect(result.cfiRange).toBe("epubcfi(/6/4[chap01]!/4/2:50,80)");
    expect(result.text).toBe("new text");
  });

  it("does not merge highlights from different chapters", async () => {
    const { createHighlight } = await import("@/lib/annotations");

    // Same offsets but different chapter — no merge
    const existing = createTestHighlight({
      chapterHref: "chapter2.xhtml",
      cfiRange: "epubcfi(/6/4[chap02]!/4/2:0,15)",
      text: "other chapter",
    });
    useBookStore.setState({ highlights: [existing] });

    const result = await createHighlight(
      "book-test-1",
      "chapter1.xhtml",
      "epubcfi(/6/4[chap01]!/4/2:5,10)",
      "new text",
      "#ff0000"
    );

    const { highlights } = useBookStore.getState();
    expect(highlights).toHaveLength(2);
    expect(result.text).toBe("new text");
  });

  it("does not merge highlights from different books", async () => {
    const { createHighlight } = await import("@/lib/annotations");

    // Same offsets but different book — no merge
    const existing = createTestHighlight({
      bookId: "other-book",
      cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,15)",
      text: "other book",
    });
    useBookStore.setState({ highlights: [existing] });

    const result = await createHighlight(
      "book-test-1",
      "chapter1.xhtml",
      "epubcfi(/6/4[chap01]!/4/2:5,10)",
      "new text",
      "#ff0000"
    );

    const { highlights } = useBookStore.getState();
    expect(highlights).toHaveLength(2);
    expect(result.text).toBe("new text");
  });

  it("assigns new ID to merged highlight (never reuses old IDs)", async () => {
    const { createHighlight } = await import("@/lib/annotations");

    const existing = createTestHighlight({
      id: "hl-old-123",
      cfiRange: "epubcfi(/6/4[chap01]!/4/2:5,15)",
      text: "existing",
    });
    useBookStore.setState({ highlights: [existing] });

    const result = await createHighlight(
      "book-test-1",
      "chapter1.xhtml",
      "epubcfi(/6/4[chap01]!/4/2:0,10)",
      "new",
      "#ff0000"
    );

    expect(result.id).not.toBe("hl-old-123");
    expect(result.id).toMatch(/^hl_/);
  });

  it("persists merged highlights to disk", async () => {
    const { createHighlight } = await import("@/lib/annotations");
    const { saveHighlightsToFile } = await import("@/lib/annotations/persistence");

    const existing = createTestHighlight({
      cfiRange: "epubcfi(/6/4[chap01]!/4/2:5,15)",
      text: "existing",
    });
    useBookStore.setState({ highlights: [existing] });

    await createHighlight(
      "book-test-1",
      "chapter1.xhtml",
      "epubcfi(/6/4[chap01]!/4/2:0,10)",
      "new",
      "#ff0000"
    );

    expect(saveHighlightsToFile).toHaveBeenCalledWith("book-test-1", expect.any(Array));
  });

  it("handles chain of 3+ highlights merging transitively", async () => {
    const { createHighlight } = await import("@/lib/annotations");

    // [0, 10), [8, 18), [16, 25) — chain of overlaps
    // New highlight [5, 20) overlaps all three transitively
    const existing1 = createTestHighlight({
      cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,10)",
      text: "a",
    });
    const existing2 = createTestHighlight({
      cfiRange: "epubcfi(/6/4[chap01]!/4/2:8,18)",
      text: "b",
    });
    const existing3 = createTestHighlight({
      cfiRange: "epubcfi(/6/4[chap01]!/4/2:16,25)",
      text: "c",
    });
    useBookStore.setState({ highlights: [existing1, existing2, existing3] });

    const result = await createHighlight(
      "book-test-1",
      "chapter1.xhtml",
      "epubcfi(/6/4[chap01]!/4/2:5,20)",
      "new",
      "#0000ff"
    );

    const { highlights } = useBookStore.getState();
    expect(highlights).toHaveLength(1);
    expect(result.cfiRange).toBe("epubcfi(/6/4[chap01]!/4/2:0,25)");
    expect(result.text).toBe("a new b c");
  });
});
