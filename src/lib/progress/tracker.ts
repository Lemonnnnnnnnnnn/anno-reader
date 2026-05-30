/**
 * Progress tracker with auto-save capabilities.
 *
 * Watches for chapter changes and scroll events, automatically
 * persisting progress with configurable debounce behavior.
 */

import { useBookStore, type ReadingProgress } from "@/stores/useBookStore";
import { saveProgressToFile } from "./persistence";
import type { ProgressData, ProgressConfig } from "./types";
import { DEFAULT_PROGRESS_CONFIG } from "./types";

/** Internal state for the tracker */
interface TrackerState {
  /** Current book ID being tracked */
  bookId: string | null;
  /** Last saved chapter href (to detect chapter changes) */
  lastChapterHref: string | null;
  /** Debounce timer for scroll saves */
  scrollTimer: ReturnType<typeof setTimeout> | null;
  /** Whether a save is currently in progress */
  saving: boolean;
  /** Pending save data (to avoid losing updates during async save) */
  pendingSave: ProgressData | null;
}

const trackerState: TrackerState = {
  bookId: null,
  lastChapterHref: null,
  scrollTimer: null,
  saving: false,
  pendingSave: null,
};

/**
 * Convert store ReadingProgress + UI state to persistable ProgressData.
 */
function toProgressData(
  bookId: string,
  filePath: string,
  progress: ReadingProgress
): ProgressData {
  return {
    bookId,
    filePath,
    chapterHref: progress.chapterHref,
    chapterIndex: progress.chapterIndex,
    scrollOffset: progress.scrollOffset,
    percentage: progress.percentage,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Perform the actual save, handling queued saves.
 */
async function performSave(data: ProgressData): Promise<void> {
  if (trackerState.saving) {
    // Queue this save
    trackerState.pendingSave = data;
    return;
  }

  trackerState.saving = true;

  try {
    await saveProgressToFile(data);
  } catch (err) {
    console.error("[Progress] Failed to save progress:", err);
  } finally {
    trackerState.saving = false;

    // Process any queued save
    if (trackerState.pendingSave) {
      const pending = trackerState.pendingSave;
      trackerState.pendingSave = null;
      await performSave(pending);
    }
  }
}

/**
 * Save progress immediately (for chapter changes).
 */
function saveImmediate(data: ProgressData): void {
  performSave(data);
}

/**
 * Save progress with debounce (for scroll events).
 */
function saveDebounced(
  data: ProgressData,
  delayMs: number
): void {
  if (trackerState.scrollTimer) {
    clearTimeout(trackerState.scrollTimer);
  }

  trackerState.scrollTimer = setTimeout(() => {
    trackerState.scrollTimer = null;
    performSave(data);
  }, delayMs);
}

/**
 * Start tracking reading progress for a book.
 *
 * Subscribes to Zustand store changes and auto-saves progress
 * when chapter or scroll position changes.
 *
 * @param bookId - The book ID to track.
 * @param filePath - Path to the EPUB file.
 * @param config - Optional configuration overrides.
 * @returns An unsubscribe function to stop tracking.
 */
export function trackProgress(
  bookId: string,
  filePath: string,
  config: Partial<ProgressConfig> = {}
): () => void {
  const fullConfig = { ...DEFAULT_PROGRESS_CONFIG, ...config };

  // Reset tracker state
  trackerState.bookId = bookId;
  trackerState.lastChapterHref = null;

  // Subscribe to store changes
  const unsubscribe = useBookStore.subscribe((state, prevState) => {
    const { readingProgress, ui } = state;

    if (!readingProgress || readingProgress.bookId !== bookId) {
      return;
    }

    const chapterChanged =
      fullConfig.autoSaveOnChapterChange &&
      ui.currentChapter !== trackerState.lastChapterHref;

    const scrollChanged =
      fullConfig.autoSaveOnScroll &&
      ui.scrollPosition !== prevState.ui.scrollPosition;

    if (!chapterChanged && !scrollChanged) {
      return;
    }

    // Build progress data from current store state
    const data = toProgressData(bookId, filePath, {
      ...readingProgress,
      chapterHref: ui.currentChapter || readingProgress.chapterHref,
      chapterIndex: ui.currentChapterIndex,
      scrollOffset: ui.scrollPosition,
    });

    if (chapterChanged) {
      trackerState.lastChapterHref = ui.currentChapter;
      saveImmediate(data);
    } else if (scrollChanged) {
      saveDebounced(data, fullConfig.scrollDebounceMs);
    }
  });

  return () => {
    unsubscribe();

    // Clean up pending timers
    if (trackerState.scrollTimer) {
      clearTimeout(trackerState.scrollTimer);
      trackerState.scrollTimer = null;
    }

    trackerState.bookId = null;
    trackerState.lastChapterHref = null;
  };
}

/**
 * Force save the current progress (e.g., before closing).
 * Cancels any pending debounced saves.
 */
export async function flushProgress(): Promise<void> {
  if (trackerState.scrollTimer) {
    clearTimeout(trackerState.scrollTimer);
    trackerState.scrollTimer = null;
  }

  // If there's a pending save, execute it immediately
  if (trackerState.pendingSave) {
    const pending = trackerState.pendingSave;
    trackerState.pendingSave = null;
    await performSave(pending);
  }
}
