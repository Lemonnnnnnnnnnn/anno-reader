/**
 * Keyboard navigation hook for ReaderPage.
 *
 * Handles arrow key navigation between chapters from two sources:
 * 1. Direct keydown events on the parent window
 * 2. postMessage events forwarded from the iframe (when iframe has focus)
 *
 * Includes input guard to prevent navigation while typing in text fields.
 */

import { useCallback } from "react";
import { useBookStore, type ReadingProgress } from "@/stores/useBookStore";
import type { ParsedEpub } from "@/lib/epub";
import { useKeyboardAction } from "@/hooks/useKeyboardAction";

/** Message shape posted from the iframe keyboard forwarder script */
export interface KeyboardMessage {
  type: "iframe-keydown";
  key: string;
}

export function useKeyboardNav(parsedEpub: ParsedEpub | null) {
  const ui = useBookStore((state) => state.ui);
  const setCurrentChapter = useBookStore((state) => state.setCurrentChapter);
  const setScrollPosition = useBookStore((state) => state.setScrollPosition);
  const setReadingProgress = useBookStore((state) => state.setReadingProgress);
  const currentBook = useBookStore((state) => state.currentBook);

  /**
   * Navigate to a chapter by index.
   * Mirrors ChapterNavigation.goToChapter() logic:
   * - Updates current chapter in UI state
   * - Resets scroll position
   * - Updates reading progress
   */
  const goToChapter = useCallback(
    (index: number) => {
      if (!parsedEpub || parsedEpub.chapters.length === 0) return;

      const totalChapters = parsedEpub.chapters.length;
      if (index < 0 || index >= totalChapters) return;

      const chapter = parsedEpub.chapters[index];
      if (!chapter) return;

      // Update current chapter in UI state
      setCurrentChapter(chapter.href, index);

      // Reset scroll position for new chapter
      setScrollPosition(0);

      // Update reading progress in store to keep in sync
      if (currentBook) {
        const percentage =
          totalChapters > 0
            ? Math.round(((index + 1) / totalChapters) * 100)
            : 0;

        const updatedProgress: ReadingProgress = {
          bookId: currentBook.id,
          chapterHref: chapter.href,
          chapterIndex: index,
          scrollOffset: 0,
          percentage,
        };

        setReadingProgress(updatedProgress);
      }
    },
    [
      parsedEpub,
      currentBook,
      setCurrentChapter,
      setScrollPosition,
      setReadingProgress,
    ],
  );

  useKeyboardAction("previousChapter", () => goToChapter(ui.currentChapterIndex - 1));
  useKeyboardAction("nextChapter", () => goToChapter(ui.currentChapterIndex + 1));
}
