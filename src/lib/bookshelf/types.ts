/**
 * Bookshelf type definitions.
 *
 * Extends BookMetadata with progress information for bookshelf display.
 */

import type { BookMetadata } from "@/stores/useBookStore";

/**
 * Reading progress summary for bookshelf display.
 * Lighter than full ReadingProgress - only what's needed for the card UI.
 */
export interface ProgressSummary {
  percentage: number;
  lastChapter: string;
}

/**
 * Book item as displayed on the bookshelf.
 * Extends BookMetadata with progress information.
 */
export interface BookshelfItem extends BookMetadata {
  progress: ProgressSummary | null;
}

/**
 * Raw bookshelf data stored in bookshelf.json.
 */
export interface BookshelfData {
  books: BookMetadata[];
}
