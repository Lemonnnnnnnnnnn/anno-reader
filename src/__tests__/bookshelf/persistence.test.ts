/**
 * Tests for bookshelf persistence layer.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BookMetadata } from "@/stores/useBookStore";

// Mock Tauri FS plugin
vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock config module
vi.mock("@/lib/storage/config", () => ({
  readConfig: vi.fn(),
}));

describe("bookshelf persistence", () => {
  const mockBook: BookMetadata = {
    id: "test-id-1",
    title: "Test Book",
    author: "Test Author",
    coverUrl: null,
    filePath: "/path/to/book.epub",
    lastOpened: 1714500000000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty array when bookshelf file does not exist", async () => {
    const { readConfig } = await import("@/lib/storage/config");
    const { exists } = await import("@tauri-apps/plugin-fs");

    vi.mocked(readConfig).mockResolvedValue({ dataDir: "/test/data", showTocSidebar: true, showNotesSidebar: true });
    vi.mocked(exists).mockResolvedValue(false);

    const { loadBookshelf } = await import("@/lib/bookshelf/persistence");
    const result = await loadBookshelf();

    expect(result).toEqual([]);
  });

  it("should load books from bookshelf file", async () => {
    const { readConfig } = await import("@/lib/storage/config");
    const { exists, readTextFile } = await import("@tauri-apps/plugin-fs");

    vi.mocked(readConfig).mockResolvedValue({ dataDir: "/test/data", showTocSidebar: true, showNotesSidebar: true });
    vi.mocked(exists).mockResolvedValue(true);
    vi.mocked(readTextFile).mockResolvedValue(
      JSON.stringify({ books: [mockBook] })
    );

    const { loadBookshelf } = await import("@/lib/bookshelf/persistence");
    const result = await loadBookshelf();

    expect(result).toEqual([mockBook]);
  });

  it("should save books to bookshelf file", async () => {
    const { readConfig } = await import("@/lib/storage/config");
    const { writeTextFile, mkdir, exists } = await import("@tauri-apps/plugin-fs");

    vi.mocked(readConfig).mockResolvedValue({ dataDir: "/test/data", showTocSidebar: true, showNotesSidebar: true });
    vi.mocked(exists).mockResolvedValue(false);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeTextFile).mockResolvedValue(undefined);

    const { saveBookshelf } = await import("@/lib/bookshelf/persistence");
    await saveBookshelf([mockBook]);

    expect(writeTextFile).toHaveBeenCalledWith(
      "/test/data/bookshelf.json",
      JSON.stringify({ books: [mockBook] }, null, 2)
    );
  });

  it("should return empty array on corrupted JSON", async () => {
    const { readConfig } = await import("@/lib/storage/config");
    const { exists, readTextFile } = await import("@tauri-apps/plugin-fs");

    vi.mocked(readConfig).mockResolvedValue({ dataDir: "/test/data", showTocSidebar: true, showNotesSidebar: true });
    vi.mocked(exists).mockResolvedValue(true);
    vi.mocked(readTextFile).mockResolvedValue("not valid json{{{" );

    const { loadBookshelf } = await import("@/lib/bookshelf/persistence");
    const result = await loadBookshelf();

    expect(result).toEqual([]);
  });

  it("should add a new book to bookshelf", async () => {
    const { readConfig } = await import("@/lib/storage/config");
    const { exists, readTextFile, writeTextFile, mkdir } = await import("@tauri-apps/plugin-fs");

    vi.mocked(readConfig).mockResolvedValue({ dataDir: "/test/data", showTocSidebar: true, showNotesSidebar: true });
    vi.mocked(exists).mockResolvedValue(true);
    vi.mocked(readTextFile).mockResolvedValue(JSON.stringify({ books: [] }));
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeTextFile).mockResolvedValue(undefined);

    const { addBookToBookshelf } = await import("@/lib/bookshelf/persistence");
    await addBookToBookshelf(mockBook);

    expect(writeTextFile).toHaveBeenCalledWith(
      "/test/data/bookshelf.json",
      JSON.stringify({ books: [mockBook] }, null, 2)
    );
  });

  it("should update an existing book in bookshelf", async () => {
    const { readConfig } = await import("@/lib/storage/config");
    const { exists, readTextFile, writeTextFile, mkdir } = await import("@tauri-apps/plugin-fs");

    vi.mocked(readConfig).mockResolvedValue({ dataDir: "/test/data", showTocSidebar: true, showNotesSidebar: true });
    vi.mocked(exists).mockResolvedValue(true);
    vi.mocked(readTextFile).mockResolvedValue(JSON.stringify({ books: [mockBook] }));
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeTextFile).mockResolvedValue(undefined);

    const updatedBook = { ...mockBook, title: "Updated Title" };
    const { addBookToBookshelf } = await import("@/lib/bookshelf/persistence");
    await addBookToBookshelf(updatedBook);

    expect(writeTextFile).toHaveBeenCalledWith(
      "/test/data/bookshelf.json",
      JSON.stringify({ books: [updatedBook] }, null, 2)
    );
  });

  it("should remove a book from bookshelf", async () => {
    const { readConfig } = await import("@/lib/storage/config");
    const { exists, readTextFile, writeTextFile, mkdir } = await import("@tauri-apps/plugin-fs");

    vi.mocked(readConfig).mockResolvedValue({ dataDir: "/test/data", showTocSidebar: true, showNotesSidebar: true });
    vi.mocked(exists).mockResolvedValue(true);
    vi.mocked(readTextFile).mockResolvedValue(JSON.stringify({ books: [mockBook] }));
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeTextFile).mockResolvedValue(undefined);

    const { removeBookFromBookshelf } = await import("@/lib/bookshelf/persistence");
    await removeBookFromBookshelf("test-id-1");

    expect(writeTextFile).toHaveBeenCalledWith(
      "/test/data/bookshelf.json",
      JSON.stringify({ books: [] }, null, 2)
    );
  });

  it("should update book metadata in bookshelf", async () => {
    const { readConfig } = await import("@/lib/storage/config");
    const { exists, readTextFile, writeTextFile, mkdir } = await import("@tauri-apps/plugin-fs");

    vi.mocked(readConfig).mockResolvedValue({ dataDir: "/test/data", showTocSidebar: true, showNotesSidebar: true });
    vi.mocked(exists).mockResolvedValue(true);
    vi.mocked(readTextFile).mockResolvedValue(JSON.stringify({ books: [mockBook] }));
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeTextFile).mockResolvedValue(undefined);

    const { updateBookInBookshelf } = await import("@/lib/bookshelf/persistence");
    await updateBookInBookshelf("test-id-1", { title: "New Title" });

    const expectedBook = { ...mockBook, title: "New Title" };
    expect(writeTextFile).toHaveBeenCalledWith(
      "/test/data/bookshelf.json",
      JSON.stringify({ books: [expectedBook] }, null, 2)
    );
  });

  it("should not save when updating a non-existent book", async () => {
    const { readConfig } = await import("@/lib/storage/config");
    const { exists, readTextFile, writeTextFile } = await import("@tauri-apps/plugin-fs");

    vi.mocked(readConfig).mockResolvedValue({ dataDir: "/test/data", showTocSidebar: true, showNotesSidebar: true });
    vi.mocked(exists).mockResolvedValue(true);
    vi.mocked(readTextFile).mockResolvedValue(JSON.stringify({ books: [mockBook] }));

    const { updateBookInBookshelf } = await import("@/lib/bookshelf/persistence");
    await updateBookInBookshelf("non-existent-id", { title: "New Title" });

    expect(writeTextFile).not.toHaveBeenCalled();
  });
});
