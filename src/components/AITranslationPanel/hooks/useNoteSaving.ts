/**
 * Note saving hook for AITranslationPanel.
 *
 * Handles:
 * - Saving translation as annotation note
 * - Saving state management
 */

import { useState, useCallback } from "react";
import { useBookStore } from "@/stores/useBookStore";
import { createNote } from "@/lib/annotations";

interface UseNoteSavingParams {
  chapterHref: string;
  cfiRange: string;
  selectedText: string;
  translationText: string;
  onClose: () => void;
  onError: (message: string) => void;
}

export function useNoteSaving({
  chapterHref,
  cfiRange,
  selectedText,
  translationText,
  onClose,
  onError,
}: UseNoteSavingParams) {
  const [isSaving, setIsSaving] = useState(false);
  const currentBook = useBookStore((s) => s.currentBook);

  const handleAddNote = useCallback(async () => {
    if (!currentBook) return;
    setIsSaving(true);
    try {
      await createNote(
        currentBook.id,
        chapterHref,
        cfiRange,
        selectedText,
        translationText,
      );
      onClose();
    } catch {
      onError("Failed to save note");
    } finally {
      setIsSaving(false);
    }
  }, [currentBook, chapterHref, cfiRange, selectedText, translationText, onClose, onError]);

  return {
    isSaving,
    handleAddNote,
  };
}
