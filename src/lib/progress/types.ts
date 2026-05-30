/**
 * Types for the reading progress module.
 * These types represent persisted reading progress data,
 * decoupled from the Zustand store shape.
 */

/**
 * Persisted reading progress for a single book.
 * Stored as JSON in the app's data directory.
 */
export interface ProgressData {
  /** Unique book identifier (matches BookMetadata.id) */
  bookId: string;
  /** Path to the EPUB file (for cross-reference) */
  filePath: string;
  /** Current chapter href (e.g., "Text/chapter1.xhtml") */
  chapterHref: string;
  /** Current chapter index in the spine */
  chapterIndex: number;
  /** Scroll offset within the chapter (pixels from top) */
  scrollOffset: number;
  /** Reading percentage (0-100) */
  percentage: number;
  /** ISO timestamp of last progress update */
  lastUpdated: string;
}

/**
 * Configuration for the progress tracker.
 */
export interface ProgressConfig {
  /** Debounce delay in ms for scroll-based saves (default: 1000) */
  scrollDebounceMs: number;
  /** Whether to auto-save on chapter change (default: true) */
  autoSaveOnChapterChange: boolean;
  /** Whether to auto-save on scroll (default: true) */
  autoSaveOnScroll: boolean;
}

/**
 * Default configuration values.
 */
export const DEFAULT_PROGRESS_CONFIG: ProgressConfig = {
  scrollDebounceMs: 1000,
  autoSaveOnChapterChange: true,
  autoSaveOnScroll: true,
};
