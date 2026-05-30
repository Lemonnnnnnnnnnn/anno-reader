/**
 * Types for the metadata extraction module.
 * These types represent the output of metadata extraction,
 * decoupled from both epubix internals and the epub parser layer.
 */

/** Core book metadata extracted from an EPUB file */
export interface ExtractedMetadata {
  /** Book title (defaults to "Unknown Title" if missing) */
  title: string;
  /** Author name (defaults to "Unknown Author" if missing) */
  author: string;
  /** Language code, e.g. "en" (empty string if missing) */
  language: string;
  /** Unique identifier, e.g. ISBN or UUID (empty string if missing) */
  identifier: string;
  /** Cover image as a base64 data URI, or null if no cover found */
  coverUrl: string | null;
}

/** Result of cover image extraction */
export interface CoverResult {
  /** Whether a cover was successfully extracted */
  found: boolean;
  /** The data URI (e.g. "data:image/jpeg;base64,..."), or null */
  dataUrl: string | null;
  /** MIME type of the extracted image, or null */
  mimeType: string | null;
}
