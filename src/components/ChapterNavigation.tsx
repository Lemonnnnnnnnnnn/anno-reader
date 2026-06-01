/**
 * ChapterNavigation component.
 *
 * Reusable chapter navigation with previous/next buttons.
 * Handles first/last chapter boundaries, updates reading progress
 * on chapter change, and resets scroll position for new chapters.
 *
 * Integrates with the Zustand store for state management and the
 * progress module for automatic progress tracking.
 *
 * @example
 * ```tsx
 * // Compact variant (icon buttons + chapter indicator)
 * <ChapterNavigation chapters={parsedEpub.chapters} variant="compact" />
 *
 * // Full variant (text buttons with chapter title)
 * <ChapterNavigation chapters={parsedEpub.chapters} variant="full" />
 *
 * // With progress callback
 * <ChapterNavigation
 *   chapters={parsedEpub.chapters}
 *   onChapterChange={(index, href) => console.log(`Navigated to ${href}`)}
 * />
 * ```
 */

import { useCallback } from "react";
import { useBookStore, type ReadingProgress } from "@/stores/useBookStore";
import type { EpubChapterInfo } from "@/lib/epub";
import { Button, Icon } from "@/components/primitives";

interface ChapterNavigationProps {
  /** Array of chapters in reading order */
  chapters: EpubChapterInfo[];
  /** Display variant: compact (icons) or full (text buttons) */
  variant?: "compact" | "full";
  /** Whether to show the chapter indicator (X / Y) */
  showChapterInfo?: boolean;
  /** Optional callback fired after chapter change */
  onChapterChange?: (index: number, href: string) => void;
}

export function ChapterNavigation({
  chapters,
  variant = "compact",
  showChapterInfo = true,
  onChapterChange,
}: ChapterNavigationProps) {
  const currentChapterIndex = useBookStore(
    (state) => state.ui.currentChapterIndex
  );
  const setCurrentChapter = useBookStore((state) => state.setCurrentChapter);
  const setScrollPosition = useBookStore((state) => state.setScrollPosition);
  const setReadingProgress = useBookStore((state) => state.setReadingProgress);
  const readingProgress = useBookStore((state) => state.readingProgress);
  const currentBook = useBookStore((state) => state.currentBook);

  const totalChapters = chapters.length;
  const isFirstChapter = currentChapterIndex <= 0;
  const isLastChapter = currentChapterIndex >= totalChapters - 1;

  const currentChapter = chapters[currentChapterIndex] ?? null;
  const chapterTitle =
    currentChapter?.title || `Chapter ${currentChapterIndex + 1}`;

  /**
   * Navigate to a specific chapter index.
   * Updates store state, resets scroll, and syncs reading progress.
   */
  const goToChapter = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalChapters) return;

      const chapter = chapters[index];
      if (!chapter) return;

      // Update current chapter in UI state
      setCurrentChapter(chapter.href, index);

      // Reset scroll position for new chapter
      setScrollPosition(0);

      // Update reading progress in store to keep in sync
      if (currentBook) {
        const percentage = totalChapters > 0
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

      // Fire optional callback
      onChapterChange?.(index, chapter.href);
    },
    [
      chapters,
      totalChapters,
      currentBook,
      setCurrentChapter,
      setScrollPosition,
      setReadingProgress,
      onChapterChange,
    ]
  );

  const goToPrevious = useCallback(() => {
    goToChapter(currentChapterIndex - 1);
  }, [currentChapterIndex, goToChapter]);

  const goToNext = useCallback(() => {
    goToChapter(currentChapterIndex + 1);
  }, [currentChapterIndex, goToChapter]);

  if (totalChapters === 0) return null;

  const isCompact = variant === "compact";

  return (
    <div
      className={
        isCompact
          ? "flex items-center gap-3"
          : "flex items-center justify-between gap-4 py-3 px-4 bg-surface border-b border-border"
      }
    >
      {/* Previous button */}
      <Button
        variant="nav"
        className={
          isCompact
            ? "w-9 h-9 p-0 bg-transparent text-text text-xs font-medium"
            : "gap-1 text-xs font-medium tracking-wide"
        }
        onClick={goToPrevious}
        disabled={isFirstChapter}
        aria-label="Previous chapter"
        title={isFirstChapter ? "Already at first chapter" : "Previous chapter"}
      >
        {isCompact ? (
          <Icon name="chevron-left" size={16} />
        ) : (
          <>
            <Icon name="chevron-left" size={16} />
            <span className="leading-none">Prev</span>
          </>
        )}
      </Button>

      {/* Chapter indicator */}
      {showChapterInfo && (
        <div
          className={
            isCompact
              ? "flex items-center min-w-[60px] justify-center"
              : "flex flex-col items-center gap-[2px] min-w-0 flex-1"
          }
        >
          {isCompact ? (
            <span className="text-xs text-text-secondary font-normal tracking-wide tabular-nums">
              {currentChapterIndex + 1} / {totalChapters}
            </span>
          ) : (
            <>
              <span className="text-sm text-text-secondary truncate max-w-[300px] text-center">
                {chapterTitle}
              </span>
              <span className="text-xs text-text-secondary font-normal tracking-wide tabular-nums">
                {currentChapterIndex + 1} / {totalChapters}
              </span>
            </>
          )}
        </div>
      )}

      {/* Next button */}
      <Button
        variant="nav"
        className={
          isCompact
            ? "w-9 h-9 p-0 bg-transparent text-text text-xs font-medium"
            : "gap-1 text-xs font-medium tracking-wide"
        }
        onClick={goToNext}
        disabled={isLastChapter}
        aria-label="Next chapter"
        title={isLastChapter ? "Already at last chapter" : "Next chapter"}
      >
        {isCompact ? (
          <Icon name="chevron-right" size={16} />
        ) : (
          <>
            <span className="leading-none">Next</span>
            <Icon name="chevron-right" size={16} />
          </>
        )}
      </Button>
    </div>
  );
}
