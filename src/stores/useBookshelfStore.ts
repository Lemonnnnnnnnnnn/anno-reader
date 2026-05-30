/**
 * Bookshelf state management.
 *
 * Manages the list of books in the bookshelf, separate from
 * the current reading state in useBookStore.
 */

import { create } from "zustand";
import type { BookMetadata } from "./useBookStore";
import {
  loadBookshelf,
  addBookToBookshelf,
  removeBookFromBookshelf,
  updateBookInBookshelf,
} from "@/lib/bookshelf";

// --- Store ---

export interface BookshelfState {
  /** List of books in the bookshelf */
  books: BookMetadata[];
  /** Loading state for async operations */
  loading: boolean;
  /** Error message, if any */
  error: string | null;
}

export interface BookshelfActions {
  /** Load all books from persistence */
  loadBooks: () => Promise<void>;
  /** Add a book to the bookshelf */
  addBook: (book: BookMetadata) => Promise<void>;
  /** Remove a book from the bookshelf (does not delete files) */
  removeBook: (bookId: string) => Promise<void>;
  /** Update a book's metadata */
  updateBook: (bookId: string, updates: Partial<BookMetadata>) => Promise<void>;
  /** Clear error state */
  clearError: () => void;
}

export type BookshelfStore = BookshelfState & BookshelfActions;

export const useBookshelfStore = create<BookshelfStore>((set) => ({
  // Initial state
  books: [],
  loading: false,
  error: null,

  // Actions
  loadBooks: async () => {
    set({ loading: true, error: null });
    try {
      const books = await loadBookshelf();
      set({ books, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load bookshelf";
      set({ error: message, loading: false });
    }
  },

  addBook: async (book: BookMetadata) => {
    set({ error: null });
    try {
      await addBookToBookshelf(book);
      set((state) => ({
        books: [...state.books.filter((b) => b.id !== book.id), book],
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add book";
      set({ error: message });
    }
  },

  removeBook: async (bookId: string) => {
    set({ error: null });
    try {
      await removeBookFromBookshelf(bookId);
      set((state) => ({
        books: state.books.filter((b) => b.id !== bookId),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove book";
      set({ error: message });
    }
  },

  updateBook: async (bookId: string, updates: Partial<BookMetadata>) => {
    set({ error: null });
    try {
      await updateBookInBookshelf(bookId, updates);
      set((state) => ({
        books: state.books.map((b) =>
          b.id === bookId ? { ...b, ...updates } : b
        ),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update book";
      set({ error: message });
    }
  },

  clearError: () => set({ error: null }),
}));
