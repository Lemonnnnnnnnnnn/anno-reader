/**
 * Reading progress module for EPUB reader.
 *
 * Provides functions for tracking, persisting, and restoring reading progress.
 * Integrates with the Zustand store for reactive state management and uses
 * Tauri's filesystem plugin for JSON-based persistence.
 *
 * @example
 * ```ts
 * import { restoreProgress, trackProgress, flushProgress } from "@/lib/progress";
 *
 * // When opening a book
 * const restored = await restoreProgress(bookId, filePath);
 * if (restored) {
 *   console.log(`Restored to chapter ${restored.chapterIndex}`);
 * }
 *
 * // Start tracking (returns unsubscribe function)
 * const stopTracking = trackProgress(bookId, filePath);
 *
 * // Before closing book
 * await flushProgress();
 * stopTracking();
 * ```
 */

import { useBookStore, type ReadingProgress } from "@/stores/useBookStore";
import { loadProgressFromFile } from "./persistence";
import { trackProgress, flushProgress } from "./tracker";
import type { ProgressData, ProgressConfig } from "./types";

/**
 * Restore reading progress for a book.
 *
 * Loads persisted progress from disk and updates the Zustand store
 * with the saved chapter, scroll position, and percentage.
 *
 * @param bookId - The book ID to restore progress for.
 * @param filePath - Path to the EPUB file.
 * @returns The restored progress data, or null if no saved progress exists.
 */
export async function restoreProgress(
  bookId: string,
  filePath: string
): Promise<ProgressData | null> {
  const saved = await loadProgressFromFile(bookId);

  if (!saved) {
    return null;
  }

  // Update the Zustand store with restored progress
  const store = useBookStore.getState();

  const readingProgress: ReadingProgress = {
    bookId: saved.bookId,
    chapterHref: saved.chapterHref,
    chapterIndex: saved.chapterIndex,
    scrollOffset: saved.scrollOffset,
    percentage: saved.percentage,
  };

  store.setReadingProgress(readingProgress);
  store.setCurrentChapter(saved.chapterHref, saved.chapterIndex);
  store.setScrollPosition(saved.scrollOffset);

  return saved;
}

/**
 * Initialize progress tracking for a book.
 *
 * Combines restore + track into a single convenience function.
 * Restores any saved progress and starts auto-saving.
 *
 * @param bookId - The book ID to initialize.
 * @param filePath - Path to the EPUB file.
 * @param config - Optional tracker configuration.
 * @returns The restored progress data (if any) and a cleanup function.
 */
export async function initProgress(
  bookId: string,
  filePath: string,
  config?: Partial<ProgressConfig>
): Promise<{ restored: ProgressData | null; cleanup: () => void }> {
  const restored = await restoreProgress(bookId, filePath);
  const cleanup = trackProgress(bookId, filePath, config);

  return { restored, cleanup };
}

// Re-export public API
export { trackProgress, flushProgress } from "./tracker";
export { loadProgressFromFile, deleteProgressFile } from "./persistence";
export type { ProgressData, ProgressConfig } from "./types";
export { DEFAULT_PROGRESS_CONFIG } from "./types";
