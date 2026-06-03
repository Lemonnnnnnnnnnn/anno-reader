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

// Mock persistence module
vi.mock("@/lib/annotations/persistence", () => ({
  loadNotesFromFile: vi.fn().mockResolvedValue([]),
  saveNotesToFile: vi.fn().mockResolvedValue(undefined),
  deleteNotesFile: vi.fn().mockResolvedValue(undefined),
  loadHighlightsFromFile: vi.fn().mockResolvedValue([]),
  saveHighlightsToFile: vi.fn().mockResolvedValue(undefined),
  deleteHighlightsFile: vi.fn().mockResolvedValue(undefined),
}));

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
