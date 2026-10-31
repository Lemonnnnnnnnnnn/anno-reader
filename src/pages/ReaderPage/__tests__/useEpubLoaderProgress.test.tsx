/**
 * Regression test: leaving the reader (/settings, /bookshelf, …) unmounts
 * ReaderPage; returning must restore the saved chapter, not land on page 1.
 *
 * The reader is mounted twice over the same book with the REAL progress
 * module (tracker + restore) — only the fs persistence layer is faked.
 * Guards against the load effect's cleanup running mid-load (via a
 * parsedEpub dependency) and orphaning the progress tracker, which then
 * overwrites the saved progress file with chapter 0 on the next visit.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useBookStore } from "@/stores/useBookStore";
import { useEpubLoader } from "../hooks/useEpubLoader";
import type { ProgressData } from "@/lib/progress/types";

// In-memory stand-in for entries/{id}/progress.json on disk.
const disk = vi.hoisted(() => ({
  progressFiles: new Map<string, string>(),
  saves: [] as string[],
}));

// A 10-chapter book returned by the (mocked) EPUB parser.
const fakeBook = vi.hoisted(() => ({
  metadata: { title: "Test Book", author: "Author" },
  coverUrl: null,
  chapters: Array.from({ length: 10 }, (_, i) => ({
    href: `ch${i}.xhtml`,
    title: `Chapter ${i + 1}`,
    content: `<p>Chapter ${i + 1}</p>`,
  })),
  toc: [],
  resources: {},
  opfFolder: "",
  manifestHrefs: {},
}));

vi.mock("@/lib/import", () => ({
  importBook: vi.fn(),
  EpubImportError: class extends Error {},
  ImportErrorCode: {},
  ensurePersistedCopy: vi.fn(async (book: { filePath: string }) => book.filePath),
  readFileAsArrayBuffer: vi.fn(async () => new ArrayBuffer(0)),
}));

vi.mock("@/lib/epub", () => ({
  loadEpub: vi.fn(async () => fakeBook),
}));

vi.mock("@/lib/pdf", () => ({ loadPdf: vi.fn(), destroyPdfDocument: vi.fn() }));
vi.mock("@/lib/annotations", () => ({ restoreNotes: vi.fn(), restoreHighlights: vi.fn() }));
vi.mock("@/lib/summaries", () => ({ restoreSummaries: vi.fn() }));

// Fake only the fs layer of the progress module — tracker/restore stay real.
vi.mock("@/lib/progress/persistence", () => ({
  saveProgressToFile: vi.fn(async (p: ProgressData) => {
    disk.saves.push(`${p.chapterHref}@${p.scrollOffset}`);
    disk.progressFiles.set(p.bookId, JSON.stringify(p));
  }),
  loadProgressFromFile: vi.fn(async (id: string) => {
    const raw = disk.progressFiles.get(id);
    return raw ? (JSON.parse(raw) as ProgressData) : null;
  }),
}));

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

function Probe() {
  const { parsedEpub } = useEpubLoader();
  const index = useBookStore((s) => s.ui.currentChapterIndex);
  return <p>{parsedEpub ? `chapter ${index}` : "loading"}</p>;
}

it("reader → settings → back returns to the saved chapter, not chapter 0", async () => {
  // Saved progress: user stopped reading at chapter 6 (index 5).
  disk.progressFiles.set("b1", JSON.stringify({
    bookId: "b1",
    filePath: "b1.epub",
    chapterHref: "ch5.xhtml",
    chapterIndex: 5,
    scrollOffset: 500,
    percentage: 50,
    lastUpdated: new Date().toISOString(),
  }));

  act(() => {
    useBookStore.getState().setBook({
      id: "b1",
      title: "Test Book",
      author: "Author",
      coverUrl: null,
      filePath: "b1.epub",
      lastOpened: 1,
    });
  });

  // --- First mount: open the book from the bookshelf ---
  const root1 = createRoot(document.createElement("div"));
  await act(async () => {
    root1.render(<Probe />);
  });
  expect(useBookStore.getState().ui.currentChapterIndex).toBe(5);

  // User scrolls a bit; the tracker persists the new offset
  await act(async () => {
    useBookStore.getState().setScrollPosition(300);
  });
  expect(JSON.parse(disk.progressFiles.get("b1")!).scrollOffset).toBe(300);

  // --- Leave to /settings: ReaderPage unmounts (tracker must be stopped) ---
  await act(async () => {
    root1.unmount();
  });
  disk.saves.length = 0;

  // --- Return to /reader: ReaderPage mounts fresh ---
  const root2 = createRoot(document.createElement("div"));
  await act(async () => {
    root2.render(<Probe />);
  });

  // The stale tracker must not have overwritten the saved chapter during
  // the remount's reset-to-chapter-0, and restore must land on chapter 5.
  expect(disk.saves).toEqual([]);
  expect(useBookStore.getState().ui.currentChapterIndex).toBe(5);
  expect(useBookStore.getState().ui.scrollPosition).toBe(300);
});
