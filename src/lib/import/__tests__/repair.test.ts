/**
 * Tests for ensurePersistedCopy — the repair pass that back-fills the
 * data-directory copy for bookshelf entries still pointing at their original
 * source file.
 *
 * IO boundaries are mocked: the fs plugin, the data-dir config, and the
 * bookshelf persistence layer.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { copyFile } from "@tauri-apps/plugin-fs";
import { updateEntry } from "@/lib/bookshelf";
import { ensurePersistedCopy } from "../repair";
import { useBookStore, type BookMetadata } from "@/stores/useBookStore";

vi.mock("@tauri-apps/plugin-fs", () => ({
  copyFile: vi.fn(),
  mkdir: vi.fn(),
  exists: vi.fn(async () => true),
}));

vi.mock("@/lib/storage/config", () => ({
  readConfig: vi.fn(async () => ({ dataDir: "/data" })),
}));

vi.mock("@/lib/bookshelf", () => ({
  loadBookshelf: vi.fn(async () => []),
  addEntry: vi.fn(async () => undefined),
  removeEntry: vi.fn(async () => undefined),
  updateEntry: vi.fn(async () => undefined),
  entryToBookMetadata: vi.fn(),
}));

/** A PDF imported before the data-directory copy existed. */
function originalPathBook(overrides: Partial<BookMetadata> = {}): BookMetadata {
  return {
    id: "book_1",
    title: "Paper",
    author: "Alice",
    coverUrl: null,
    filePath: "/Users/crow/Documents/paper.pdf",
    lastOpened: 0,
    format: "pdf",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(copyFile).mockResolvedValue(undefined);
  useBookStore.setState({ currentBook: null });
});

describe("ensurePersistedCopy", () => {
  it("returns a persisted path untouched", async () => {
    const path = await ensurePersistedCopy(
      originalPathBook({ filePath: "entries/book_1/book.pdf" }),
    );

    expect(path).toBe("entries/book_1/book.pdf");
    expect(copyFile).not.toHaveBeenCalled();
    expect(updateEntry).not.toHaveBeenCalled();
  });

  it("copies a book that still points at its original path and repoints the entry", async () => {
    const path = await ensurePersistedCopy(originalPathBook());

    expect(copyFile).toHaveBeenCalledWith(
      "/Users/crow/Documents/paper.pdf",
      "/data/entries/book_1/book.pdf",
    );
    expect(updateEntry).toHaveBeenCalledWith("book_1", {
      filePath: "entries/book_1/book.pdf",
    });
    expect(path).toBe("entries/book_1/book.pdf");
  });

  it("keeps the open book in sync when it is the repaired book", async () => {
    useBookStore.setState({ currentBook: originalPathBook() });

    await ensurePersistedCopy(originalPathBook());

    expect(useBookStore.getState().currentBook?.filePath).toBe(
      "entries/book_1/book.pdf",
    );
  });

  it("leaves the open book alone when repairing another book", async () => {
    useBookStore.setState({
      currentBook: originalPathBook({ id: "book_2", filePath: "/tmp/other.pdf" }),
    });

    await ensurePersistedCopy(originalPathBook());

    expect(useBookStore.getState().currentBook?.filePath).toBe("/tmp/other.pdf");
  });

  it("falls back to the original path when the copy fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(copyFile).mockRejectedValue(new Error("forbidden path"));

    const path = await ensurePersistedCopy(originalPathBook());

    expect(path).toBe("/Users/crow/Documents/paper.pdf");
    expect(updateEntry).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("infers the persisted filename from the source extension", async () => {
    const path = await ensurePersistedCopy({
      id: "book_1",
      title: "Novel",
      author: "",
      coverUrl: null,
      filePath: "/Users/crow/Books/novel.epub",
      lastOpened: 0,
    });

    expect(copyFile).toHaveBeenCalledWith(
      "/Users/crow/Books/novel.epub",
      "/data/entries/book_1/book.epub",
    );
    expect(path).toBe("entries/book_1/book.epub");
  });
});
