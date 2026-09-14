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

/**
 * Tauri plugin commands reject with plain strings rather than Error objects,
 * so extract the raw message to avoid losing the real cause.
 */
function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback;
}

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
      set({ error: toErrorMessage(err, "Failed to load bookshelf"), loading: false });
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
        ...(book.format ? { format: book.format } : {}),
        addedAt: book.lastOpened,
        lastOpened: book.lastOpened,
      };

      await addEntry(entry);
      set((state) => ({
        books: [...state.books.filter((b) => b.id !== book.id), book],
      }));
    } catch (err) {
      set({ error: toErrorMessage(err, "Failed to add book") });
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
      set({ error: toErrorMessage(err, "Failed to remove book") });
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
      set({ error: toErrorMessage(err, "Failed to update book") });
    }
  },

  clearError: () => set({ error: null }),
}));
