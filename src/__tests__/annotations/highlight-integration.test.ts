/**
 * Integration tests for the full highlight workflow.
 *
 * Tests end-to-end flows through the annotation API + Zustand store:
 * - create → color change → verify state & persistence
 * - create → delete → verify state & persistence
 * - overlap merge: create A → create overlapping B → verify merge
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

const BOOK_ID = "book-test-1";
const CHAPTER = "chapter1.xhtml";

describe("highlight integration: create → color change", () => {
  beforeEach(() => {
    useBookStore.setState({ highlights: [], notes: [] });
  });

  it("creates highlight then updates color, verifying state", async () => {
    const { createHighlight, updateHighlight } = await import("@/lib/annotations");

    // Step 1: Create a highlight
    const created = await createHighlight(
      BOOK_ID,
      CHAPTER,
      "epubcfi(/6/4[chap01]!/4/2:0,10)",
      "selected text",
      "#ffff00"
    );

    // Verify highlight exists in store
    let { highlights } = useBookStore.getState();
    expect(highlights).toHaveLength(1);
    expect(highlights[0].id).toBe(created.id);
    expect(highlights[0].color).toBe("#ffff00");

    // Step 2: Change color (simulates popover color picker)
    await updateHighlight(created.id, { color: "#bfdbfe" }, BOOK_ID);

    // Verify color updated in store
    highlights = useBookStore.getState().highlights;
    expect(highlights).toHaveLength(1);
    expect(highlights[0].color).toBe("#bfdbfe");
    // Other fields unchanged
    expect(highlights[0].text).toBe("selected text");
    expect(highlights[0].cfiRange).toBe("epubcfi(/6/4[chap01]!/4/2:0,10)");
  });

  it("persists color change to disk", async () => {
    const { createHighlight, updateHighlight } = await import("@/lib/annotations");
    const { saveHighlightsToFile } = await import("@/lib/annotations/persistence");

    const created = await createHighlight(
      BOOK_ID,
      CHAPTER,
      "epubcfi(/6/4[chap01]!/4/2:0,10)",
      "text",
      "#ffff00"
    );

    vi.mocked(saveHighlightsToFile).mockClear();

    await updateHighlight(created.id, { color: "#00ff00" }, BOOK_ID);

    // Persistence called with updated data
    expect(saveHighlightsToFile).toHaveBeenCalledWith(BOOK_ID, expect.any(Array));
    const savedData = vi.mocked(saveHighlightsToFile).mock.calls[0][1];
    expect(savedData).toHaveLength(1);
    expect(savedData[0].color).toBe("#00ff00");
  });

  it("color change is idempotent — calling twice yields same result", async () => {
    const { createHighlight, updateHighlight } = await import("@/lib/annotations");

    const created = await createHighlight(
      BOOK_ID,
      CHAPTER,
      "epubcfi(/6/4[chap01]!/4/2:0,10)",
      "text",
      "#ffff00"
    );

    await updateHighlight(created.id, { color: "#bfdbfe" }, BOOK_ID);
    await updateHighlight(created.id, { color: "#bfdbfe" }, BOOK_ID);

    const { highlights } = useBookStore.getState();
    expect(highlights).toHaveLength(1);
    expect(highlights[0].color).toBe("#bfdbfe");
  });
});

describe("highlight integration: create → delete", () => {
  beforeEach(() => {
    useBookStore.setState({ highlights: [], notes: [] });
  });

  it("creates highlight then deletes it, verifying empty state", async () => {
    const { createHighlight, deleteHighlight } = await import("@/lib/annotations");

    // Step 1: Create
    const created = await createHighlight(
      BOOK_ID,
      CHAPTER,
      "epubcfi(/6/4[chap01]!/4/2:0,10)",
      "text to delete",
      "#ffff00"
    );

    expect(useBookStore.getState().highlights).toHaveLength(1);

    // Step 2: Delete (simulates popover delete button)
    await deleteHighlight(created.id, BOOK_ID);

    // Verify highlight removed from store
    const { highlights } = useBookStore.getState();
    expect(highlights).toHaveLength(0);
  });

  it("persists deletion to disk", async () => {
    const { createHighlight, deleteHighlight } = await import("@/lib/annotations");
    const { saveHighlightsToFile } = await import("@/lib/annotations/persistence");

    const created = await createHighlight(
      BOOK_ID,
      CHAPTER,
      "epubcfi(/6/4[chap01]!/4/2:0,10)",
      "text",
      "#ffff00"
    );

    vi.mocked(saveHighlightsToFile).mockClear();

    await deleteHighlight(created.id, BOOK_ID);

    // Persistence called with empty array
    expect(saveHighlightsToFile).toHaveBeenCalledWith(BOOK_ID, []);
  });

  it("deleting one highlight preserves other highlights", async () => {
    const { createHighlight, deleteHighlight } = await import("@/lib/annotations");

    // Create two non-overlapping highlights
    const hl1 = await createHighlight(
      BOOK_ID,
      CHAPTER,
      "epubcfi(/6/4[chap01]!/4/2:0,10)",
      "first",
      "#ffff00"
    );
    const hl2 = await createHighlight(
      BOOK_ID,
      CHAPTER,
      "epubcfi(/6/4[chap01]!/4/2:50,60)",
      "second",
      "#00ff00"
    );

    expect(useBookStore.getState().highlights).toHaveLength(2);

    // Delete only the first
    await deleteHighlight(hl1.id, BOOK_ID);

    const { highlights } = useBookStore.getState();
    expect(highlights).toHaveLength(1);
    expect(highlights[0].id).toBe(hl2.id);
    expect(highlights[0].text).toBe("second");
  });
});

describe("highlight integration: overlap merge", () => {
  beforeEach(() => {
    useBookStore.setState({ highlights: [], notes: [] });
  });

  it("merges overlapping highlight B into existing highlight A", async () => {
    const { createHighlight } = await import("@/lib/annotations");

    // Create highlight A: [0, 15)
    const hlA = await createHighlight(
      BOOK_ID,
      CHAPTER,
      "epubcfi(/6/4[chap01]!/4/2:0,15)",
      "highlight A",
      "#ffff00"
    );

    expect(useBookStore.getState().highlights).toHaveLength(1);

    // Create overlapping highlight B: [10, 25) — overlaps A
    const merged = await createHighlight(
      BOOK_ID,
      CHAPTER,
      "epubcfi(/6/4[chap01]!/4/2:10,25)",
      "highlight B",
      "#ff0000"
    );

    // After merge: only 1 highlight remains
    const { highlights } = useBookStore.getState();
    expect(highlights).toHaveLength(1);

    // Merged highlight has union range [0, 25)
    expect(merged.cfiRange).toBe("epubcfi(/6/4[chap01]!/4/2:0,25)");
    // Text concatenated in range order (A then B)
    expect(merged.text).toBe("highlight A highlight B");
    // New highlight's color wins
    expect(merged.color).toBe("#ff0000");
    // New ID assigned (not reusing A's ID)
    expect(merged.id).not.toBe(hlA.id);
    expect(merged.id).toMatch(/^hl_/);
  });

  it("persists merged highlight to disk", async () => {
    const { createHighlight } = await import("@/lib/annotations");
    const { saveHighlightsToFile } = await import("@/lib/annotations/persistence");

    await createHighlight(
      BOOK_ID,
      CHAPTER,
      "epubcfi(/6/4[chap01]!/4/2:0,15)",
      "A",
      "#ffff00"
    );

    vi.mocked(saveHighlightsToFile).mockClear();

    await createHighlight(
      BOOK_ID,
      CHAPTER,
      "epubcfi(/6/4[chap01]!/4/2:10,25)",
      "B",
      "#ff0000"
    );

    // Persistence called with merged data
    expect(saveHighlightsToFile).toHaveBeenCalledWith(BOOK_ID, expect.any(Array));
    const savedData = vi.mocked(saveHighlightsToFile).mock.calls[0][1];
    expect(savedData).toHaveLength(1);
    expect(savedData[0].cfiRange).toBe("epubcfi(/6/4[chap01]!/4/2:0,25)");
  });

  it("non-overlapping highlights are kept separate", async () => {
    const { createHighlight } = await import("@/lib/annotations");

    // Create highlight A: [0, 10)
    await createHighlight(
      BOOK_ID,
      CHAPTER,
      "epubcfi(/6/4[chap01]!/4/2:0,10)",
      "first",
      "#ffff00"
    );

    // Create highlight B: [50, 60) — no overlap with A
    await createHighlight(
      BOOK_ID,
      CHAPTER,
      "epubcfi(/6/4[chap01]!/4/2:50,60)",
      "second",
      "#00ff00"
    );

    const { highlights } = useBookStore.getState();
    expect(highlights).toHaveLength(2);
    expect(highlights[0].text).toBe("first");
    expect(highlights[1].text).toBe("second");
  });
});
