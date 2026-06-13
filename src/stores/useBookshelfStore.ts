/**
 * Bookshelf state management.
 */

import { create } from "zustand";
import type { BookMetadata } from "./useBookStore";
import type { BookEntry } from "@/lib/bookshelf";
import {
  loadBookshelf,
  addEntry,
  removeEntry,
  updateEntry,
  entryToBookMetadata,
} from "@/lib/bookshelf";

// --- Store ---

export interface BookshelfState {
  books: BookMetadata[];
  loading: boolean;
  error: string | null;
}

export interface BookshelfActions {
  loadBooks: () => Promise<void>;
  addBook: (book: BookMetadata) => Promise<void>;
  removeBook: (bookId: string) => Promise<void>;
  updateBook: (bookId: string, updates: Partial<BookMetadata>) => Promise<void>;
  clearError: () => void;
}

export type BookshelfStore = BookshelfState & BookshelfActions;

export const useBookshelfStore = create<BookshelfStore>((set) => ({
  books: [],
  loading: false,
  error: null,

  loadBooks: async () => {
    set({ loading: true, error: null });
    try {
      const entries = await loadBookshelf();
      const books = entries
        .filter((e): e is BookEntry => e.type === "book")
        .map(entryToBookMetadata);
      set({ books, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load bookshelf";
      set({ error: message, loading: false });
    }
  },

  addBook: async (book: BookMetadata) => {
    set({ error: null });
    try {
      const entry: BookEntry = {
        type: "book",
        id: book.id,
        title: book.title,
        author: book.author,
        coverUrl: book.coverUrl,
        filePath: book.filePath,
        addedAt: book.lastOpened,
        lastOpened: book.lastOpened,
      };

      await addEntry(entry);
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
      await removeEntry(bookId, true);
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
      await updateEntry(bookId, updates);
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
