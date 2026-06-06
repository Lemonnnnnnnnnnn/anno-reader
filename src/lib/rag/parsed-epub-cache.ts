/**
 * Module-level cache for ParsedEpub access during RAG indexing.
 * Keeps a single reference in memory, cleared on book change.
 * Avoids Zustand to prevent unnecessary re-renders.
 */

import type { ParsedEpub } from "../epub/types";
import { extractPlainText } from "./chunker";

/** Cached ParsedEpub instance, or null if no book is loaded. */
let cachedEpub: ParsedEpub | null = null;

/**
 * Store a ParsedEpub in the module-level cache.
 * Call this when a book is loaded or changed.
 */
export function setParsedEpub(epub: ParsedEpub): void {
  cachedEpub = epub;
}

/**
 * Retrieve the cached ParsedEpub, or null if none is set.
 */
export function getParsedEpub(): ParsedEpub | null {
  return cachedEpub;
}

/**
 * Clear the cached ParsedEpub.
 * Call this on book change or when the book is closed.
 */
export function clearParsedEpub(): void {
  cachedEpub = null;
}

/**
 * Get plain text for a single chapter by its ID.
 * Uses extractPlainText to convert HTML content.
 *
 * @param chapterId - The chapter's spine idref
 * @returns Plain text of the chapter, or null if not found
 */
export function getChapterText(chapterId: string): string | null {
  if (!cachedEpub) return null;

  const chapter = cachedEpub.chapters.find((ch) => ch.id === chapterId);
  if (!chapter) return null;

  return extractPlainText(chapter.content);
}

/**
 * Get plain text for all chapters in spine order.
 *
 * @returns Array of { id, title, text } for each chapter
 */
export function getAllChapterTexts(): Array<{
  id: string;
  title: string;
  text: string;
}> {
  if (!cachedEpub) return [];

  return cachedEpub.chapters.map((ch) => ({
    id: ch.id,
    title: ch.title,
    text: extractPlainText(ch.content),
  }));
}
