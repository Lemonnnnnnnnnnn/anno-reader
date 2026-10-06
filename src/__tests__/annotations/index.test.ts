/**
 * Tests for updateHighlight function in annotations module.
 *
 * Verifies that updateHighlight calls store.updateHighlight() and
 * persists highlights to disk.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useBookStore, type Highlight } from "@/stores/useBookStore";
import { createTestHighlight } from "@/__tests__/helpers/annotation-test-helpers";
import { setNoteStarred, restoreNotes, updateNote } from "@/lib/annotations";
import { saveNotesToFile, loadNotesFromFile } from "@/lib/annotations/persistence";

// Mock persistence module
vi.mock("@/lib/annotations/persistence", () => ({
  loadNotesFromFile: vi.fn().mockResolvedValue([]),
  saveNotesToFile: vi.fn().mockResolvedValue(undefined),
  deleteNotesFile: vi.fn().mockResolvedValue(undefined),
  loadHighlightsFromFile: vi.fn().mockResolvedValue([]),
  saveHighlightsToFile: vi.fn().mockResolvedValue(undefined),
  deleteHighlightsFile: vi.fn().mockResolvedValue(undefined),
}));

describe("note stars", () => {
  const note = { id: "note-1", bookId: "book-1", chapterHref: "chapter", cfiRange: "range", text: "quote", content: "content", createdAt: 1000 };
  beforeEach(() => {
    vi.clearAllMocks();
    useBookStore.setState({ notes: [{ ...note }], highlights: [] });
  });
  it("persists stars, preserves them across content edits and restores them from disk", async () => {
    await setNoteStarred(note.id, true, note.bookId);
    await updateNote(note.id, "edited", note.bookId);
    expect(useBookStore.getState().notes[0]).toMatchObject({ starred: true, content: "edited" });
    const saved = vi.mocked(saveNotesToFile).mock.calls.at(-1)![1];
    expect(saved[0]).toMatchObject({ starred: true, content: "edited" });
    vi.mocked(loadNotesFromFile).mockResolvedValueOnce(saved);
    useBookStore.setState({ notes: [] });
    await restoreNotes(note.bookId);
    expect(useBookStore.getState().notes[0]).toMatchObject({ starred: true, content: "edited" });
    await setNoteStarred(note.id, false, note.bookId);
    expect(useBookStore.getState().notes[0].starred).toBe(false);
  });
  it("loads old notes without a star as unstarred", async () => {
    vi.mocked(loadNotesFromFile).mockResolvedValueOnce([{ ...note, createdAt: new Date(1000).toISOString(), updatedAt: new Date(1000).toISOString() }]);
    await restoreNotes(note.bookId);
    expect(useBookStore.getState().notes[0].starred).toBe(false);
  });
  it("rolls back a star when saving fails and ignores notes belonging to another book", async () => {
    vi.mocked(saveNotesToFile).mockRejectedValueOnce(new Error("disk failure"));
    await expect(setNoteStarred(note.id, true, note.bookId)).rejects.toThrow("disk failure");
    expect(useBookStore.getState().notes[0].starred).toBeUndefined();
    await setNoteStarred(note.id, true, "other-book");
    expect(saveNotesToFile).toHaveBeenCalledTimes(1);
  });
});

describe("updateHighlight", () => {
  beforeEach(() => {
    useBookStore.setState({ highlights: [], notes: [] });
  });

  it("calls store.updateHighlight with the correct highlightId and updates", async () => {
    const { updateHighlight } = await import("@/lib/annotations");
    const highlight = createTestHighlight({ bookId: "book-1" });
    useBookStore.setState({ highlights: [highlight] });

    const spy = vi.spyOn(useBookStore.getState(), "updateHighlight");

    await updateHighlight(highlight.id, { color: "#ff0000" }, "book-1");

    expect(spy).toHaveBeenCalledWith(highlight.id, { color: "#ff0000" });
    spy.mockRestore();
  });

  it("updates the highlight color in the store", async () => {
    const { updateHighlight } = await import("@/lib/annotations");
    const highlight = createTestHighlight({ bookId: "book-1", color: "#ffff00" });
    useBookStore.setState({ highlights: [highlight] });

    await updateHighlight(highlight.id, { color: "#00ff00" }, "book-1");

    const { highlights } = useBookStore.getState();
    expect(highlights[0].color).toBe("#00ff00");
  });

  it("calls persistHighlights to save changes to disk", async () => {
    const { updateHighlight } = await import("@/lib/annotations");
    const { saveHighlightsToFile } = await import("@/lib/annotations/persistence");
    const highlight = createTestHighlight({ bookId: "book-1" });
    useBookStore.setState({ highlights: [highlight] });

    await updateHighlight(highlight.id, { color: "#0000ff" }, "book-1");

    expect(saveHighlightsToFile).toHaveBeenCalledWith("book-1", expect.any(Array));
  });

  it("does not throw when highlight ID is not found", async () => {
    const { updateHighlight } = await import("@/lib/annotations");

    await expect(
      updateHighlight("nonexistent-id", { color: "#ff0000" }, "book-1")
    ).resolves.not.toThrow();
  });
});
