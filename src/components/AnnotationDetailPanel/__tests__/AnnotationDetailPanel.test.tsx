/**
 * Tests for the AnnotationDetailPanel component.
 *
 * Uses renderToString (node env) to avoid jsdom ESM issues. The Modal
 * primitive is portal-based and evaluates document.body eagerly, which the
 * node env lacks — so Modal is mocked with the same aria-label contract
 * while the default Drawer path uses the real primitive.
 * Tests structural rendering; interaction is covered by integration tests.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import { AnnotationDetailPanel } from "..";

vi.mock("@/components/primitives", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/primitives")>();

  // Portal-free stand-in for Modal that preserves its markup contract
  // (title, close button aria-label, content, pinned footer).
  const Modal = ({
    open,
    onClose,
    title,
    children,
    footer,
  }: {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    footer?: ReactNode;
  }) =>
    open ? (
      <div>
        {title && (
          <div>
            <h2>{title}</h2>
            <button aria-label="Close dialog" onClick={onClose} />
          </div>
        )}
        {children}
        {footer}
      </div>
    ) : null;

  return { ...actual, Modal };
});

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

describe("AnnotationDetailPanel", () => {
  it("renders nothing when noteId is null", () => {
    const html = renderToString(
      <AnnotationDetailPanel noteId={null} onClose={vi.fn()} />,
    );

    expect(html).toBe("");
  });

  it("renders as a drawer by default with note detail", () => {
    const html = renderToString(
      <AnnotationDetailPanel noteId="note-1" onClose={vi.fn()} />,
    );

    expect(html).toContain("Note Detail");
    expect(html).toContain('aria-label="Close drawer"');
  });

  it("renders as a centered modal when variant is modal", () => {
    const html = renderToString(
      <AnnotationDetailPanel
        noteId="note-1"
        onClose={vi.fn()}
        variant="modal"
      />,
    );

    expect(html).toContain("Note Detail");
    expect(html).toContain('aria-label="Close dialog"');
    expect(html).not.toContain('aria-label="Close drawer"');
  });

  it("renders the quoted original text", () => {
    const html = renderToString(
      <AnnotationDetailPanel noteId="note-1" onClose={vi.fn()} />,
    );

    expect(html).toContain("Selected text in the book");
  });

  it("renders the live markdown editor (no read-only view, no manual save)", () => {
    const html = renderToString(
      <AnnotationDetailPanel noteId="note-1" onClose={vi.fn()} />,
    );

    // Editor container is present; the old edit toggle is gone entirely.
    expect(html).toContain("markdown-editor");
    expect(html).not.toContain("Edit note");
    expect(html).not.toContain("Save");
  });

  it("renders delete button", () => {
    const html = renderToString(
      <AnnotationDetailPanel noteId="note-1" onClose={vi.fn()} />,
    );

    expect(html).toContain("Delete note");
  });

  it("renders different quoted text when noteId changes", () => {
    const html = renderToString(
      <AnnotationDetailPanel noteId="note-2" onClose={vi.fn()} />,
    );

    // The editor content itself is client-rendered; SSR shows the quote.
    expect(html).toContain("Another selection");
  });

  it("renders listen-to-section button", () => {
    const html = renderToString(
      <AnnotationDetailPanel noteId="note-1" onClose={vi.fn()} />,
    );

    expect(html).toContain("Listen to section");
  });

  it("renders timestamp", () => {
    const html = renderToString(
      <AnnotationDetailPanel noteId="note-1" onClose={vi.fn()} />,
    );

    // Timestamp should be rendered as a date string
    expect(html).toMatch(/\d{1,2}:\d{2}/);
  });
});
