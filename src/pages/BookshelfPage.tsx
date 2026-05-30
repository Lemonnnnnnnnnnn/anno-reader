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
import type { BookshelfItem } from "@/lib/bookshelf";

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
      <div style={styles.layout}>
        <div style={styles.loadingState}>
          <div style={styles.loadingSpinner} />
          <p style={styles.loadingText}>Loading bookshelf...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.layout}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.headerLeft}>
            <h1 style={styles.appTitle}>Anno Reader</h1>
            <p style={styles.appSubtitle}>
              {books.length} {books.length === 1 ? "book" : "books"}
            </p>
          </div>
          <button style={styles.importButton} onClick={handleImport}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Import EPUB
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={styles.content}>
        {error && (
          <div style={styles.errorBanner}>
            <span style={styles.errorText}>{error}</span>
            <button style={styles.errorDismiss} onClick={clearError}>
              Dismiss
            </button>
          </div>
        )}

        {books.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
            <h2 style={styles.emptyTitle}>Your bookshelf is empty</h2>
            <p style={styles.emptySubtitle}>
              Import an EPUB file to start building your library
            </p>
            <button style={styles.emptyImportButton} onClick={handleImport}>
              Import Your First Book
            </button>
          </div>
        ) : (
          <div style={styles.grid}>
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

// --- Design tokens (aligned with ReaderLayout palette) ---

const colors = {
  bg: "#f6f6f6",
  surface: "#ffffff",
  text: "#0f0f0f",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  border: "#e5e5e5",
  accent: "#374151",
  accentHover: "#1f2937",
  error: "#dc2626",
  errorBg: "#fef2f2",
  errorBorder: "#fecaca",
} as const;

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
    background: colors.bg,
    color: colors.text,
    fontFamily:
      "'Literata', 'Georgia', 'Iowan Old Style', 'Palatino Linotype', 'Noto Serif', 'Noto Serif CJK SC', serif",
    fontOpticalSizing: "auto",
    fontFeatureSettings: "'kern' 1, 'liga' 1",
  },

  // Header
  header: {
    flexShrink: 0,
    background: colors.surface,
    borderBottom: `1px solid ${colors.border}`,
  },
  headerContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 24px",
    maxWidth: "1200px",
    margin: "0 auto",
    width: "100%",
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  appTitle: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 600,
    color: colors.text,
    letterSpacing: "-0.02em",
  },
  appSubtitle: {
    margin: 0,
    fontSize: "0.8rem",
    color: colors.textSecondary,
  },
  importButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: colors.surface,
    background: colors.accent,
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "background 0.15s",
    fontFamily: "inherit",
  },

  // Content
  content: {
    flex: 1,
    overflow: "auto",
    padding: "24px",
  },

  // Grid
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "20px",
    maxWidth: "1200px",
    margin: "0 auto",
  },

  // Empty state
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: "16px",
    textAlign: "center",
  },
  emptyIcon: {
    color: colors.textMuted,
    opacity: 0.5,
  },
  emptyTitle: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 600,
    color: colors.text,
  },
  emptySubtitle: {
    margin: 0,
    fontSize: "0.9rem",
    color: colors.textSecondary,
    maxWidth: "280px",
  },
  emptyImportButton: {
    marginTop: "8px",
    padding: "12px 24px",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: colors.surface,
    background: colors.accent,
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontFamily: "inherit",
  },

  // Loading
  loadingState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: "16px",
  },
  loadingSpinner: {
    width: "32px",
    height: "32px",
    border: `2px solid ${colors.border}`,
    borderTopColor: colors.accent,
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    margin: 0,
    fontSize: "0.9rem",
    color: colors.textSecondary,
  },

  // Error
  errorBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px",
    marginBottom: "16px",
    background: colors.errorBg,
    border: `1px solid ${colors.errorBorder}`,
    borderRadius: "6px",
  },
  errorText: {
    fontSize: "0.85rem",
    color: colors.error,
  },
  errorDismiss: {
    padding: "4px 8px",
    fontSize: "0.8rem",
    color: colors.error,
    background: "transparent",
    border: `1px solid ${colors.errorBorder}`,
    borderRadius: "4px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
