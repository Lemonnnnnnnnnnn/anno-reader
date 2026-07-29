/**
 * Chapter summaries module for EPUB reader.
 *
 * Provides functions for creating, managing, and persisting AI-generated
 * chapter summaries. Integrates with the Zustand store for reactive state
 * management and uses Tauri's filesystem plugin for JSON-based persistence.
 *
 * @example
 * ```ts
 * import {
 *   createSummary, updateSummary, deleteSummary,
 *   getSummaryForChapter, restoreSummaries,
 * } from "@/lib/summaries";
 *
 * // When opening a book, restore saved summaries
 * await restoreSummaries(bookId);
 *
 * // After AI finishes streaming a summary
 * const summary = await createSummary(bookId, chapterHref, chapterIndex, chapterTitle, content);
 *
 * // Re-generating overwrites the existing one
 * await updateSummary(existingId, newContent, bookId);
 *
 * // Look up the saved summary for the current chapter
 * const existing = getSummaryForChapter(chapterHref);
 * ```
 */

import { useBookStore, type ChapterSummary } from "@/stores/useBookStore";
import {
  loadSummariesFromFile,
  saveSummariesToFile,
  deleteSummariesFile,
} from "./persistence";
import type { SummaryData } from "./types";

/**
 * Generate a unique ID for a summary.
 */
function generateSummaryId(): string {
  return `sum_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Convert store ChapterSummary to persistable SummaryData.
 */
function toSummaryData(summary: ChapterSummary): SummaryData {
  return {
    id: summary.id,
    bookId: summary.bookId,
    chapterHref: summary.chapterHref,
    chapterIndex: summary.chapterIndex,
    chapterTitle: summary.chapterTitle,
    content: summary.content,
    createdAt: new Date(summary.createdAt).toISOString(),
    updatedAt: new Date(summary.updatedAt).toISOString(),
  };
}

/**
 * Convert persisted SummaryData to store ChapterSummary.
 */
function toStoreSummary(data: SummaryData): ChapterSummary {
  return {
    id: data.id,
    bookId: data.bookId,
    chapterHref: data.chapterHref,
    chapterIndex: data.chapterIndex,
    chapterTitle: data.chapterTitle,
    content: data.content,
    createdAt: new Date(data.createdAt).getTime(),
    updatedAt: new Date(data.updatedAt).getTime(),
  };
}

/**
 * Persist all summaries for the current book to disk.
 */
async function persistSummaries(bookId: string): Promise<void> {
  const { summaries } = useBookStore.getState();
  const bookSummaries = summaries.filter((s) => s.bookId === bookId);
  const summaryData = bookSummaries.map(toSummaryData);
  await saveSummariesToFile(bookId, summaryData);
}

/**
 * Restore summaries for a book from disk into the Zustand store.
 *
 * @param bookId - The book ID to restore summaries for.
 * @returns The restored summaries array, or empty array if none exist.
 */
export async function restoreSummaries(bookId: string): Promise<SummaryData[]> {
  const saved = await loadSummariesFromFile(bookId);

  if (saved.length === 0) {
    return [];
  }

  // Clear existing summaries for this book and load from disk
  const { summaries } = useBookStore.getState();

  // Remove old summaries for this book
  const otherSummaries = summaries.filter((s) => s.bookId !== bookId);

  // Convert and add restored summaries
  const restoredSummaries = saved.map(toStoreSummary);

  // Update the store with all summaries
  useBookStore.setState({
    summaries: [...otherSummaries, ...restoredSummaries],
  });

  return saved;
}

/**
 * Create a new chapter summary.
 *
 * @param bookId - The book ID.
 * @param chapterHref - The chapter href the summary covers.
 * @param chapterIndex - The chapter index (for display).
 * @param chapterTitle - The chapter title, if available.
 * @param content - The Markdown summary content.
 * @returns The created summary.
 */
export async function createSummary(
  bookId: string,
  chapterHref: string,
  chapterIndex: number,
  chapterTitle: string | null,
  content: string,
): Promise<ChapterSummary> {
  const now = Date.now();
  const summary: ChapterSummary = {
    id: generateSummaryId(),
    bookId,
    chapterHref,
    chapterIndex,
    chapterTitle,
    content,
    createdAt: now,
    updatedAt: now,
  };

  // Add to store
  const store = useBookStore.getState();
  store.addSummary(summary);

  // Persist to disk
  await persistSummaries(bookId);

  return summary;
}

/**
 * Update a summary's content (e.g. after re-generating).
 *
 * @param summaryId - The summary ID to update.
 * @param content - The new Markdown content.
 * @param bookId - The book ID (for persistence).
 */
export async function updateSummary(
  summaryId: string,
  content: string,
  bookId: string,
): Promise<void> {
  const store = useBookStore.getState();
  store.updateSummary(summaryId, content);

  // Persist to disk
  await persistSummaries(bookId);
}

/**
 * Delete a summary by ID.
 *
 * @param summaryId - The summary ID to delete.
 * @param bookId - The book ID (for persistence).
 */
export async function deleteSummary(
  summaryId: string,
  bookId: string,
): Promise<void> {
  const store = useBookStore.getState();
  store.removeSummary(summaryId);

  // Persist to disk
  await persistSummaries(bookId);
}

/**
 * Get the saved summary for a specific chapter, if any.
 *
 * @param chapterHref - The chapter href to look up.
 * @param bookId - Optional book ID (uses current book if not provided).
 * @returns The summary for the chapter, or null.
 */
export function getSummaryForChapter(
  chapterHref: string,
  bookId?: string,
): ChapterSummary | null {
  const { summaries, currentBook } = useBookStore.getState();
  const targetBookId = bookId || currentBook?.id;

  return (
    summaries.find(
      (s) =>
        s.chapterHref === chapterHref &&
        (!targetBookId || s.bookId === targetBookId),
    ) ?? null
  );
}

/**
 * Delete all summaries for a book (e.g. when removing the book).
 *
 * @param bookId - The book ID to delete summaries for.
 */
export async function deleteAllSummaries(bookId: string): Promise<void> {
  // Remove from store
  useBookStore.setState((state) => ({
    summaries: state.summaries.filter((s) => s.bookId !== bookId),
  }));

  // Delete persistence file
  await deleteSummariesFile(bookId);
}

// Re-export public API
export {
  loadSummariesFromFile,
  saveSummariesToFile,
  deleteSummariesFile,
} from "./persistence";
export type { SummaryData } from "./types";
export { generateSummaryStream } from "./summaryService";
