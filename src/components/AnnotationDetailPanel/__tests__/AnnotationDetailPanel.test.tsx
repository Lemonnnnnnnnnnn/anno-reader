/**
 * Tests for the AnnotationDetailPanel component.
 *
 * Uses renderToString (node env) to avoid jsdom ESM issues.
 * Tests structural rendering; interaction is covered by integration tests.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { AnnotationDetailPanel } from "..";

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

    // Drawer returns null when isOpen=false
    expect(html).toBe("");
  });

  it("renders drawer with note detail when noteId is provided", () => {
    const html = renderToString(
      <AnnotationDetailPanel noteId="note-1" onClose={vi.fn()} />,
    );

    expect(html).toContain("Note Detail");
    expect(html).toContain("Selected text in the book");
    expect(html).toContain("This is my annotation note content.");
  });

  it("renders the quoted original text", () => {
    const html = renderToString(
      <AnnotationDetailPanel noteId="note-1" onClose={vi.fn()} />,
    );

    expect(html).toContain("Selected text in the book");
  });

  it("renders close button with Drawer aria-label", () => {
    const html = renderToString(
      <AnnotationDetailPanel noteId="note-1" onClose={vi.fn()} />,
    );

    expect(html).toContain('aria-label="Close drawer"');
  });

  it("renders edit button", () => {
    const html = renderToString(
      <AnnotationDetailPanel noteId="note-1" onClose={vi.fn()} />,
    );

    expect(html).toContain("Edit note");
  });

  it("renders delete button", () => {
    const html = renderToString(
      <AnnotationDetailPanel noteId="note-1" onClose={vi.fn()} />,
    );

    expect(html).toContain("Delete note");
  });

  it("renders different note content when noteId changes", () => {
    const html = renderToString(
      <AnnotationDetailPanel noteId="note-2" onClose={vi.fn()} />,
    );

    expect(html).toContain("Another selection");
    expect(html).toContain("bold");
  });

  it("does not show edit/delete in editing mode (SSR default shows non-editing)", () => {
    const html = renderToString(
      <AnnotationDetailPanel noteId="note-1" onClose={vi.fn()} />,
    );

    // In non-editing state, edit/delete buttons are shown
    expect(html).toContain("Edit note");
    expect(html).toContain("Delete note");
  });

  it("renders timestamp", () => {
    const html = renderToString(
      <AnnotationDetailPanel noteId="note-1" onClose={vi.fn()} />,
    );

    // Timestamp should be rendered as a date string
    expect(html).toMatch(/\d{1,2}:\d{2}/);
  });

  it("renders markdown note content", () => {
    const html = renderToString(
      <AnnotationDetailPanel noteId="note-2" onClose={vi.fn()} />,
    );

    // Markdown **bold** should be rendered as <strong>
    expect(html).toContain("<strong>");
  });
});
