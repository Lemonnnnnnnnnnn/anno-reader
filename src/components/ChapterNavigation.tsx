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
    <div style={isCompact ? styles.compactContainer : styles.fullContainer}>
      {/* Previous button */}
      <button
        style={{
          ...(isCompact ? styles.compactButton : styles.fullButton),
          ...(isFirstChapter ? styles.buttonDisabled : {}),
        }}
        onClick={goToPrevious}
        disabled={isFirstChapter}
        aria-label="Previous chapter"
        title={isFirstChapter ? "Already at first chapter" : "Previous chapter"}
      >
        {isCompact ? (
          <ChevronLeftIcon />
        ) : (
          <>
            <ChevronLeftIcon />
            <span style={styles.fullLabel}>Prev</span>
          </>
        )}
      </button>

      {/* Chapter indicator */}
      {showChapterInfo && (
        <div style={isCompact ? styles.compactInfo : styles.fullInfo}>
          {isCompact ? (
            <span style={styles.chapterCount}>
              {currentChapterIndex + 1} / {totalChapters}
            </span>
          ) : (
            <>
              <span style={styles.chapterTitle}>{chapterTitle}</span>
              <span style={styles.chapterCount}>
                {currentChapterIndex + 1} / {totalChapters}
              </span>
            </>
          )}
        </div>
      )}

      {/* Next button */}
      <button
        style={{
          ...(isCompact ? styles.compactButton : styles.fullButton),
          ...(isLastChapter ? styles.buttonDisabled : {}),
        }}
        onClick={goToNext}
        disabled={isLastChapter}
        aria-label="Next chapter"
        title={isLastChapter ? "Already at last chapter" : "Next chapter"}
      >
        {isCompact ? (
          <ChevronRightIcon />
        ) : (
          <>
            <span style={styles.fullLabel}>Next</span>
            <ChevronRightIcon />
          </>
        )}
      </button>
    </div>
  );
}

// --- Icons ---

function ChevronLeftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// --- Design tokens (aligned with ReaderLayout) ---

const colors = {
  text: "#0f0f0f",
  textSecondary: "#6b7280",
  border: "#e5e5e5",
} as const;

const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
} as const;

const styles: Record<string, React.CSSProperties> = {
  // --- Compact variant (footer-style) ---
  compactContainer: {
    display: "flex",
    alignItems: "center",
    gap: spacing.md,
  },
  compactButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    padding: 0,
    fontSize: "0.8rem",
    fontWeight: 500,
    color: colors.text,
    background: "transparent",
    border: `1px solid ${colors.border}`,
    borderRadius: "6px",
    cursor: "pointer",
    transition: "color 0.15s, border-color 0.15s, background 0.15s",
    boxShadow: "none",
    fontFamily: "inherit",
  },
  compactInfo: {
    display: "flex",
    alignItems: "center",
    minWidth: "60px",
    justifyContent: "center",
  },

  // --- Full variant (standalone) ---
  fullContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg,
    padding: `${spacing.md} ${spacing.lg}`,
    background: "#fff",
    borderBottom: `1px solid ${colors.border}`,
  },
  fullButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: spacing.xs,
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: "0.8rem",
    fontWeight: 500,
    color: colors.text,
    background: "transparent",
    border: `1px solid ${colors.border}`,
    borderRadius: "6px",
    cursor: "pointer",
    transition: "color 0.15s, border-color 0.15s, background 0.15s",
    letterSpacing: "0.01em",
    boxShadow: "none",
    fontFamily: "inherit",
  },
  fullLabel: {
    lineHeight: 1,
  },
  fullInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    minWidth: 0,
    flex: 1,
  },

  // --- Shared ---
  buttonDisabled: {
    opacity: 0.35,
    cursor: "not-allowed",
  },
  chapterTitle: {
    fontSize: "0.85rem",
    fontWeight: 500,
    color: colors.text,
    textAlign: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "300px",
  },
  chapterCount: {
    fontSize: "0.75rem",
    fontWeight: 400,
    color: colors.textSecondary,
    letterSpacing: "0.02em",
    fontVariantNumeric: "tabular-nums",
  },
};
