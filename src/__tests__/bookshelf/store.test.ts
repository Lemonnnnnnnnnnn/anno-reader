/**
 * Tests for bookshelf Zustand store.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BookMetadata } from "@/stores/useBookStore";

// Mock bookshelf persistence module
vi.mock("@/lib/bookshelf/persistence", () => ({
  loadBookshelf: vi.fn(),
  saveBookshelf: vi.fn(),
  addEntry: vi.fn(),
  removeEntry: vi.fn(),
  updateEntry: vi.fn(),
}));

// Import store at top level (module is cached by Vitest)
const { useBookshelfStore } = await import("@/stores/useBookshelfStore");

describe("useBookshelfStore", () => {
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
    useBookshelfStore.setState({
      books: [],
      loading: false,
      error: null,
    });
  });

  it("should have correct initial state", () => {
    const state = useBookshelfStore.getState();
    expect(state.books).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("should load books from bookshelf", async () => {
    const { loadBookshelf } = await import("@/lib/bookshelf/persistence");

    vi.mocked(loadBookshelf).mockResolvedValue([
      {
        type: "book",
        id: mockBook.id,
        title: mockBook.title,
        author: mockBook.author,
        coverUrl: mockBook.coverUrl,
        filePath: mockBook.filePath,
        addedAt: mockBook.lastOpened,
        lastOpened: mockBook.lastOpened,
      },
    ]);

    await useBookshelfStore.getState().loadBooks();

    const state = useBookshelfStore.getState();
    expect(state.books).toHaveLength(1);
    expect(state.books[0].id).toBe(mockBook.id);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("should handle load error", async () => {
    const { loadBookshelf } = await import("@/lib/bookshelf/persistence");

    vi.mocked(loadBookshelf).mockRejectedValue(new Error("Load failed"));

    await useBookshelfStore.getState().loadBooks();

    const state = useBookshelfStore.getState();
    expect(state.error).toBe("Load failed");
    expect(state.loading).toBe(false);
  });

  it("should add a book", async () => {
    const { addEntry } = await import("@/lib/bookshelf/persistence");

    vi.mocked(addEntry).mockResolvedValue();

    await useBookshelfStore.getState().addBook(mockBook);

    const state = useBookshelfStore.getState();
    expect(state.books).toHaveLength(1);
    expect(state.books[0].id).toBe(mockBook.id);
  });

  it("should remove a book", async () => {
    const { removeEntry } = await import("@/lib/bookshelf/persistence");

    vi.mocked(removeEntry).mockResolvedValue();

    useBookshelfStore.setState({ books: [mockBook] });

    await useBookshelfStore.getState().removeBook(mockBook.id);

    const state = useBookshelfStore.getState();
    expect(state.books).toHaveLength(0);
  });

  it("should update a book", async () => {
    const { updateEntry } = await import("@/lib/bookshelf/persistence");

    vi.mocked(updateEntry).mockResolvedValue();

    useBookshelfStore.setState({ books: [mockBook] });

    await useBookshelfStore
      .getState()
      .updateBook(mockBook.id, { title: "Updated Title" });

    const state = useBookshelfStore.getState();
    expect(state.books[0].title).toBe("Updated Title");
  });

  it("should clear error", () => {
    useBookshelfStore.setState({ error: "some error" });

    useBookshelfStore.getState().clearError();

    expect(useBookshelfStore.getState().error).toBeNull();
  });
});
