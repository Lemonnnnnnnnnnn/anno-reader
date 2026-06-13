/**
 * Types for the annotations (notes & highlights) module.
 * These types represent persisted data,
 * decoupled from the Zustand store shape.
 */

/**
 * Persisted note for a single book.
 * Stored as JSON in the app's data directory.
 */
export interface NoteData {
  /** Unique note identifier */
  id: string;
  /** Book ID this note belongs to */
  bookId: string;
  /** Chapter href where the note was created */
  chapterHref: string;
  /** CFI range of the selected text (EPUB Canonical Fragment Identifier) */
  cfiRange: string;
  /** The selected text that was annotated */
  text: string;
  /** User's note content */
  content: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Persisted highlight for a single book.
 * Stored as JSON in the app's data directory.
 */
export interface HighlightData {
  /** Unique highlight identifier */
  id: string;
  /** Book ID this highlight belongs to */
  bookId: string;
  /** Chapter href where the highlight was created */
  chapterHref: string;
  /** CFI range of the selected text (EPUB Canonical Fragment Identifier) */
  cfiRange: string;
  /** The selected text that was highlighted */
  text: string;
  /** Highlight color */
  color: string;
  /** ISO timestamp of creation */
  createdAt: string;
}

/**
 * Configuration for the notes module.
 */
export interface NoteConfig {
  /** Auto-save delay in ms after note creation/update (default: 500) */
  autoSaveDelayMs: number;
}

/**
 * Default configuration values.
 */
export const DEFAULT_NOTE_CONFIG: NoteConfig = {
  autoSaveDelayMs: 500,
};
