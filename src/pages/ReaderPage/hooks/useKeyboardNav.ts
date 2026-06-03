/**
 * Keyboard navigation hook for ReaderPage.
 *
 * Handles arrow key navigation between chapters from two sources:
 * 1. Direct keydown events on the parent window
 * 2. postMessage events forwarded from the iframe (when iframe has focus)
 *
 * Includes input guard to prevent navigation while typing in text fields.
 */

import { useEffect, useCallback } from "react";
import { useBookStore, type ReadingProgress } from "@/stores/useBookStore";
import type { ParsedEpub } from "@/lib/epub";

/** Message shape posted from the iframe keyboard forwarder script */
export interface KeyboardMessage {
  type: "keydown";
  key: string;
}

/** Check if the user is typing in an input/textarea — don't hijack keys */
function isTypingInInput(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    (el as HTMLElement).isContentEditable
  );
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

  /**
   * Handle keyboard navigation.
   * Shared logic for both direct keydown and iframe-forwarded events.
   */
  const handleNavigation = useCallback(
    (key: string) => {
      if (!parsedEpub || parsedEpub.chapters.length === 0) return;

      const totalChapters = parsedEpub.chapters.length;

      if (key === "ArrowLeft" || key === "ArrowUp") {
        if (ui.currentChapterIndex > 0) {
          goToChapter(ui.currentChapterIndex - 1);
        }
      } else if (key === "ArrowRight" || key === "ArrowDown") {
        if (ui.currentChapterIndex < totalChapters - 1) {
          goToChapter(ui.currentChapterIndex + 1);
        }
      }
    },
    [parsedEpub, ui.currentChapterIndex, goToChapter],
  );

  // Direct keyboard events on parent window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input field
      if (isTypingInInput()) return;

      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        handleNavigation(e.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNavigation]);

  // Listen for keyboard events forwarded from iframe via postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as KeyboardMessage | undefined;
      if (!data || data.type !== "keydown") return;

      if (data.key === "ArrowLeft" || data.key === "ArrowRight" || data.key === "ArrowUp" || data.key === "ArrowDown") {
        handleNavigation(data.key);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleNavigation]);
}
