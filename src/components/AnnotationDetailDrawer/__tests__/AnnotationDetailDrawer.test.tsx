/**
 * Tests for the AnnotationDetailDrawer component.
 *
 * Uses renderToString (node env) to avoid jsdom ESM issues.
 * Tests structural rendering; interaction is covered by integration tests.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { AnnotationDetailDrawer } from "..";

// Mock notes data
const mockNote = {
  id: "note-1",
  bookId: "book-1",
  chapterHref: "chapter1.xhtml",
  cfiRange: "epubcfi(/6/4!/4/2:0,5)",
  text: "Selected text in the book",
  content: "This is my annotation note content.",
  createdAt: Date.now(),
};

const mockNote2 = {
  id: "note-2",
  bookId: "book-1",
  chapterHref: "chapter1.xhtml",
  cfiRange: "epubcfi(/6/4!/4/2:10,20)",
  text: "Another selection",
  content: "A **bold** note with markdown.",
  createdAt: Date.now() - 3600000,
};

// Mock annotations lib
vi.mock("@/lib/annotations", () => ({
  deleteNote: vi.fn().mockResolvedValue(undefined),
  updateNote: vi.fn().mockResolvedValue(undefined),
}));

// Mock useBookStore — return note matching noteId
const mockNotes = [mockNote, mockNote2];
vi.mock("@/stores/useBookStore", () => ({
  useBookStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      currentBook: { id: "book-1" },
      notes: mockNotes,
    }),
}));

describe("AnnotationDetailDrawer", () => {
  it("renders nothing when noteId is null", () => {
    const html = renderToString(
      <AnnotationDetailDrawer noteId={null} onClose={vi.fn()} />,
    );

    // Drawer returns null when isOpen=false
    expect(html).toBe("");
  });

  it("renders drawer with note detail when noteId is provided", () => {
    const html = renderToString(
      <AnnotationDetailDrawer noteId="note-1" onClose={vi.fn()} />,
    );

    expect(html).toContain("Note Detail");
    expect(html).toContain("Selected text in the book");
  });

  it("renders the quoted original text", () => {
    const html = renderToString(
      <AnnotationDetailDrawer noteId="note-1" onClose={vi.fn()} />,
    );

    expect(html).toContain("Selected text in the book");
  });

  it("renders close button with Drawer aria-label", () => {
    const html = renderToString(
      <AnnotationDetailDrawer noteId="note-1" onClose={vi.fn()} />,
    );

    expect(html).toContain('aria-label="Close drawer"');
  });

  it("renders the live markdown editor (no read-only view, no manual save)", () => {
    const html = renderToString(
      <AnnotationDetailDrawer noteId="note-1" onClose={vi.fn()} />,
    );

    // Editor container is present; the old edit toggle is gone entirely.
    expect(html).toContain("markdown-editor");
    expect(html).not.toContain("Edit note");
    expect(html).not.toContain("Save");
  });

  it("renders delete button", () => {
    const html = renderToString(
      <AnnotationDetailDrawer noteId="note-1" onClose={vi.fn()} />,
    );

    expect(html).toContain("Delete note");
  });

  it("renders different quoted text when noteId changes", () => {
    const html = renderToString(
      <AnnotationDetailDrawer noteId="note-2" onClose={vi.fn()} />,
    );

    // The editor content itself is client-rendered; SSR shows the quote.
    expect(html).toContain("Another selection");
  });

  it("renders listen-to-section button", () => {
    const html = renderToString(
      <AnnotationDetailDrawer noteId="note-1" onClose={vi.fn()} />,
    );

    expect(html).toContain("Listen to section");
  });

  it("renders timestamp", () => {
    const html = renderToString(
      <AnnotationDetailDrawer noteId="note-1" onClose={vi.fn()} />,
    );

    // Timestamp should be rendered as a date string
    expect(html).toMatch(/\d{1,2}:\d{2}/);
  });
});
