/**
 * BookshelfPage component.
 *
 * Main bookshelf page displaying all imported books in a grid layout.
 * Handles book import, book selection, book removal, and navigation to reader.
 */

import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useBookshelfStore } from "@/stores/useBookshelfStore";
import { useBookStore } from "@/stores/useBookStore";
import { importEpub, EpubImportError } from "@/lib/import";
import { BookCard } from "@/components/BookCard";
import { Button, ErrorBanner } from "@/components/primitives";
import { Settings, Book, Sun, Moon } from "lucide-react";
import type { BookshelfItem } from "@/lib/bookshelf";
import useTheme from "@/hooks/useTheme";

export function BookshelfPage() {
  const navigate = useNavigate();

  const loadBooks = useBookshelfStore((state) => state.loadBooks);
  const books = useBookshelfStore((state) => state.books);
  const loading = useBookshelfStore((state) => state.loading);
  const error = useBookshelfStore((state) => state.error);
  const addBook = useBookshelfStore((state) => state.addBook);
  const removeBook = useBookshelfStore((state) => state.removeBook);
  const clearError = useBookshelfStore((state) => state.clearError);

  const setBook = useBookStore((state) => state.setBook);
  const theme = useBookStore((state) => state.ui.theme);
  const setTheme = useBookStore((state) => state.setTheme);

  useTheme();

  const handleToggleTheme = useCallback(() => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  }, [theme, setTheme]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const handleBookSelect = useCallback(
    (_book: BookshelfItem) => {
      navigate("/reader");
    },
    [navigate]
  );

  const handleImport = useCallback(async () => {
    try {
      const { book } = await importEpub();
      await addBook(book);
      setBook(book);
      handleBookSelect({ ...book, progress: null });
    } catch (err) {
      // User cancelled - not an error
      if (err instanceof EpubImportError && err.isCancellation) {
        return;
      }
      console.error("Import failed:", err);
    }
  }, [addBook, setBook, handleBookSelect]);

  const handleBookClick = useCallback(
    (book: BookshelfItem) => {
      setBook(book);
      handleBookSelect(book);
    },
    [setBook, handleBookSelect]
  );

  const handleRemove = useCallback(
    async (bookId: string) => {
      await removeBook(bookId);
    },
    [removeBook]
  );

  if (loading) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg dark:bg-bg-dark text-text dark:text-text-dark font-serif">
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="w-8 h-8 border-2 border-border dark:border-border-dark border-t-accent dark:border-t-accent-dark rounded-full animate-spin" />
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Loading bookshelf...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg dark:bg-bg-dark text-text dark:text-text-dark font-serif">
      {/* Header */}
      <header className="shrink-0 bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark">
        <div className="flex items-center justify-between px-6 py-4 max-w-[1200px] mx-auto w-full">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-xl font-semibold text-text dark:text-text-dark tracking-tight m-0">
              Anno Reader
            </h1>
            <p className="text-xs text-text-secondary dark:text-text-secondary-dark m-0">
              {books.length} {books.length === 1 ? "book" : "books"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={handleImport}>
              Import EPUB
            </Button>
            <Button variant="icon" onClick={handleToggleTheme} title="Toggle theme">
              {theme === "light" ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
            <Button variant="icon" onClick={() => navigate("/settings")} title="Settings">
              <Settings size={16} />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        {error && (
          <div className="flex items-center justify-between p-2 px-4 mb-4 bg-error-bg dark:bg-error-bg-dark border border-error dark:border-error rounded-md">
            <ErrorBanner message={error} />
            <Button variant="secondary" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        )}

        {books.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="text-text-muted dark:text-text-muted-dark opacity-50">
              <Book size={64} />
            </div>
            <h2 className="text-xl font-semibold text-text dark:text-text-dark m-0">
              Your bookshelf is empty
            </h2>
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark max-w-[280px] m-0">
              Import an EPUB file to start building your library
            </p>
            <Button variant="primary" size="lg" onClick={handleImport}>
              Import Your First Book
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-5 max-w-[1200px] mx-auto">
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={{ ...book, progress: null }}
                onClick={handleBookClick}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
