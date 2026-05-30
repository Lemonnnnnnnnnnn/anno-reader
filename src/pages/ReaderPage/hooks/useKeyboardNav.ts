/**
 * Keyboard navigation hook for ReaderPage.
 * Handles arrow key navigation between chapters.
 */

import { useEffect } from "react";
import { useBookStore } from "@/stores/useBookStore";
import type { ParsedEpub } from "@/lib/epub";

export function useKeyboardNav(parsedEpub: ParsedEpub | null) {
  const ui = useBookStore((state) => state.ui);
  const setCurrentChapter = useBookStore((state) => state.setCurrentChapter);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!parsedEpub || parsedEpub.chapters.length === 0) return;

      const totalChapters = parsedEpub.chapters.length;

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (ui.currentChapterIndex > 0) {
          const newIndex = ui.currentChapterIndex - 1;
          const chapter = parsedEpub.chapters[newIndex];
          if (chapter) {
            setCurrentChapter(chapter.href, newIndex);
          }
        }
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        if (ui.currentChapterIndex < totalChapters - 1) {
          const newIndex = ui.currentChapterIndex + 1;
          const chapter = parsedEpub.chapters[newIndex];
          if (chapter) {
            setCurrentChapter(chapter.href, newIndex);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ui.currentChapterIndex, parsedEpub, setCurrentChapter]);
}
