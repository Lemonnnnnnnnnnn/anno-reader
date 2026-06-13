/**
 * Bookshelf type definitions.
 */

import type { BookMetadata } from "@/stores/useBookStore";

/**
 * A bookshelf entry representing a book (EPUB).
 */
export interface BookEntry {
  type: "book";
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  filePath: string;
  addedAt: number;
  lastOpened: number;
}

/**
 * Union type for all bookshelf entries.
 */
export type BookshelfEntry = BookEntry;

/**
 * Bookshelf data stored in bookshelf.json.
 */
export interface BookshelfData {
  entries: BookshelfEntry[];
}

/**
 * Reading progress summary for display.
 */
export interface ProgressSummary {
  percentage: number;
  lastChapter: string;
}

/**
 * Bookshelf item with progress information.
 */
export interface BookshelfItem extends BookMetadata {
  progress: ProgressSummary | null;
}

/**
 * Convert BookEntry to BookMetadata for backward compatibility.
 */
export function entryToBookMetadata(entry: BookEntry): BookMetadata {
  return {
    id: entry.id,
    title: entry.title,
    author: entry.author,
    coverUrl: entry.coverUrl,
    filePath: entry.filePath,
    lastOpened: entry.lastOpened,
  };
}
