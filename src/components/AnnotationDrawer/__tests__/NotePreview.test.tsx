/**
 * Tests for the NotePreview overlay.
 *
 * The overlay is opened from a note card inside the Annotations drawer. Its
 * host panel has a `transform` class (slide-in animation), which becomes the
 * containing block for `position: fixed` descendants — so the modal must be
 * portaled to `document.body` to stay centered in the viewport instead of
 * collapsing into a narrow sliver inside the drawer.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import type { Note } from "@/stores/useBookStore";
import { NotePreview } from "../NotePreview";

const NOTE: Note = {
  id: "note_1",
  bookId: "book_1",
  chapterHref: "chapter1.xhtml",
  cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,10)",
  text: "heterogeneous",
  content: "**heterogeneous** /ˌhetərəˈdʒiːniəs/ adj. 异构的",
  createdAt: 1700000000000,
};

const CHAPTERS = [
  {
    id: "chap01",
    title: "Chapter 1",
    href: "chapter1.xhtml",
    content: "<p>…</p>",
    cssContent: [],
  },
];

vi.mock("@/lib/annotations", () => ({
  deleteNote: vi.fn().mockResolvedValue(undefined),
  updateNote: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/stores/useBookStore", () => ({
  useBookStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      currentBook: { id: "book_1", title: "Test Book" },
      notes: [NOTE],
    }),
}));

const mounted: { panel: HTMLElement; root: Root }[] = [];

/** Renders the preview inside a transformed wrapper, mimicking the drawer panel. */
function renderInTransformedPanel(previewNoteId: string | null) {
  const panel = document.createElement("div");
  // Drawer panel classes: the transform makes it a containing block for fixed
  // positioned descendants.
  panel.className = "transform transition-transform duration-300";
  document.body.appendChild(panel);

  const root = createRoot(panel);
  mounted.push({ panel, root });

  act(() => {
    root.render(
      <NotePreview
        previewNoteId={previewNoteId}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDrawerClose={vi.fn()}
        chapters={CHAPTERS}
      />,
    );
  });

  return panel;
}

afterEach(() => {
  mounted.forEach(({ panel, root }) => {
    act(() => root.unmount());
    panel.remove();
  });
  mounted.length = 0;
});

describe("NotePreview", () => {
  it("renders nothing when no note is previewed", () => {
    renderInTransformedPanel(null);
    expect(document.body.textContent).not.toContain("Note Preview");
  });

  it("renders the full note content in the modal", () => {
    renderInTransformedPanel(NOTE.id);

    expect(document.body.querySelector("h2")?.textContent).toBe("Note Preview");
    expect(document.body.textContent).toContain("heterogeneous");
    expect(document.body.textContent).toContain("adj. 异构的");
  });

  it("portals the overlay out of the transformed drawer panel", () => {
    const panel = renderInTransformedPanel(NOTE.id);

    const overlay = document.body.querySelector("h2")?.closest(".fixed");
    expect(overlay).not.toBeNull();
    // Escaping the transformed ancestor is what keeps the modal centered in
    // the viewport.
    expect(panel.contains(overlay!)).toBe(false);
    expect(document.body.contains(overlay!)).toBe(true);
  });
});
