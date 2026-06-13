/**
 * Content source types for both EPUB chapters and web pages.
 * Provides a unified interface for the annotation system.
 */

/** Type of content source */
export type ContentType = "epub" | "web";

/**
 * Represents a renderable content source (EPUB chapter or web page).
 */
export interface ContentSource {
  /** Unique identifier for this content source */
  id: string;
  /** Display title (chapter name or page title) */
  title: string;
  /** HTML content to render */
  html: string;
  /** Plain text version for search/selection */
  plainText: string;
  /** Optional CSS styles specific to this content */
  css?: string;
  /** Type of content source */
  type: ContentType;
}

/**
 * Reference to a specific content source within a collection.
 * Used for persistence and navigation.
 */
export interface ContentRef {
  /** Collection identifier (book ID or web collection ID) */
  collectionId: string;
  /** Source identifier within the collection (chapterHref or URL) */
  sourceId: string;
}

/**
 * Provider interface for accessing content sources.
 * Implemented by both EPUB and web content providers.
 */
export interface ContentProvider {
  /** Get all available content sources */
  getSources(): ContentSource[];
  /** Get the currently active content source */
  getCurrentSource(): ContentSource | null;
  /** Navigate to a specific content source */
  navigateTo(ref: ContentRef): void;
}

/**
 * Convert a ContentRef to a storage-safe key string.
 * Format: `{collectionId}::{sourceId}`
 *
 * @param ref - The content reference to convert
 * @returns Storage key string
 */
export function toStorageKey(ref: ContentRef): string {
  return `${ref.collectionId}::${ref.sourceId}`;
}
