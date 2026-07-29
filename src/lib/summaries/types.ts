/**
 * Types for the chapter summaries module.
 * These types represent persisted data,
 * decoupled from the Zustand store shape.
 */

/**
 * Persisted chapter summary for a single book.
 * Stored as JSON in the app's data directory.
 */
export interface SummaryData {
  /** Unique summary identifier */
  id: string;
  /** Book ID this summary belongs to */
  bookId: string;
  /** Chapter href the summary covers */
  chapterHref: string;
  /** Chapter index (for display) */
  chapterIndex: number;
  /** Chapter title (for display), if available */
  chapterTitle: string | null;
  /** Markdown summary content produced by the AI */
  content: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}
