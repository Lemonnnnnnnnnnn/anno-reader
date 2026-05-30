/**
 * Tests for bookshelf Zustand store.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BookMetadata } from "@/stores/useBookStore";

// Mock persistence module
vi.mock("@/lib/bookshelf/persistence", () => ({
  loadBookshelf: vi.fn(),
  saveBookshelf: vi.fn(),
  addBookToBookshelf: vi.fn(),
  removeBookFromBookshelf: vi.fn(),
  updateBookInBookshelf: vi.fn(),
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
    // Reset store state between tests
    useBookshelfStore.setState({ books: [], loading: false, error: null });
  });

  it("should have correct initial state", () => {
    const state = useBookshelfStore.getState();
    expect(state.books).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("should load books from persistence", async () => {
    const { loadBookshelf } = await import("@/lib/bookshelf/persistence");
    vi.mocked(loadBookshelf).mockResolvedValue([mockBook]);

    await useBookshelfStore.getState().loadBooks();

    const state = useBookshelfStore.getState();
    expect(state.books).toEqual([mockBook]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("should set error when loadBooks fails", async () => {
    const { loadBookshelf } = await import("@/lib/bookshelf/persistence");
    vi.mocked(loadBookshelf).mockRejectedValue(new Error("disk error"));

    await useBookshelfStore.getState().loadBooks();

    const state = useBookshelfStore.getState();
    expect(state.books).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBe("disk error");
  });

  it("should add a book", async () => {
    const { addBookToBookshelf, loadBookshelf } = await import("@/lib/bookshelf/persistence");
    vi.mocked(loadBookshelf).mockResolvedValue([]);
    vi.mocked(addBookToBookshelf).mockResolvedValue(undefined);

    await useBookshelfStore.getState().addBook(mockBook);

    const state = useBookshelfStore.getState();
    expect(state.books).toContainEqual(mockBook);
    expect(addBookToBookshelf).toHaveBeenCalledWith(mockBook);
  });

  it("should set error when addBook fails", async () => {
    const { addBookToBookshelf } = await import("@/lib/bookshelf/persistence");
    vi.mocked(addBookToBookshelf).mockRejectedValue(new Error("write failed"));

    await useBookshelfStore.getState().addBook(mockBook);

    const state = useBookshelfStore.getState();
    expect(state.error).toBe("write failed");
  });

  it("should remove a book", async () => {
    const { removeBookFromBookshelf, loadBookshelf } = await import("@/lib/bookshelf/persistence");
    vi.mocked(loadBookshelf).mockResolvedValue([mockBook]);
    vi.mocked(removeBookFromBookshelf).mockResolvedValue(undefined);

    // First load books
    await useBookshelfStore.getState().loadBooks();

    // Then remove
    await useBookshelfStore.getState().removeBook("test-id-1");

    const state = useBookshelfStore.getState();
    expect(state.books).not.toContainEqual(mockBook);
    expect(removeBookFromBookshelf).toHaveBeenCalledWith("test-id-1");
  });

  it("should update a book", async () => {
    const { updateBookInBookshelf, loadBookshelf } = await import("@/lib/bookshelf/persistence");
    vi.mocked(loadBookshelf).mockResolvedValue([mockBook]);
    vi.mocked(updateBookInBookshelf).mockResolvedValue(undefined);

    // First load books
    await useBookshelfStore.getState().loadBooks();

    // Then update
    await useBookshelfStore.getState().updateBook("test-id-1", { title: "Updated Title" });

    const state = useBookshelfStore.getState();
    expect(state.books[0].title).toBe("Updated Title");
    expect(updateBookInBookshelf).toHaveBeenCalledWith("test-id-1", { title: "Updated Title" });
  });

  it("should clear error", async () => {
    const { loadBookshelf } = await import("@/lib/bookshelf/persistence");
    vi.mocked(loadBookshelf).mockRejectedValue(new Error("some error"));

    await useBookshelfStore.getState().loadBooks();

    expect(useBookshelfStore.getState().error).toBe("some error");

    useBookshelfStore.getState().clearError();

    expect(useBookshelfStore.getState().error).toBeNull();
  });
});
