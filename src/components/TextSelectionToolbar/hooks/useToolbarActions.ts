/**
 * Toolbar actions hook for TextSelectionToolbar.
 *
 * Handles:
 * - Note creation workflow
 * - Highlight creation workflow
 */

import { useCallback, useState } from "react";
import { useBookStore } from "@/stores/useBookStore";
import { createNote, createHighlight } from "@/lib/annotations";
import { generateCfiRange } from "@/lib/selection";
import { getLastHighlightColor, setLastHighlightColor } from "../lastHighlightColor";
import type { SelectionState, ToolbarMode } from "../constants";

interface UseToolbarActionsParams {
  selection: SelectionState | null;
  chapterHref: string;
  setMode: (mode: ToolbarMode) => void;
  noteText: string;
  setNoteText: (text: string) => void;
  resetSelection: () => void;
}

export function useToolbarActions({
  selection,
  chapterHref,
  setMode,
  noteText,
  setNoteText,
  resetSelection,
}: UseToolbarActionsParams) {
  const [isCreating, setIsCreating] = useState(false);
  const currentBook = useBookStore((state) => state.currentBook);

  /**
   * Handle "Add Note" action — show note input.
   */
  const handleAddNote = useCallback(() => {
    setMode("note");
    setNoteText("");
  }, [setMode, setNoteText]);

  /**
   * Create a highlight with the selected color and remember it for next time.
   */
  const handleCreateHighlight = useCallback(
    async (color: string) => {
      if (!selection || !currentBook) return;

      setIsCreating(true);
      try {
        const cfiRange = generateCfiRange(
          chapterHref,
          selection.startOffset,
          selection.endOffset,
        );
        await createHighlight(
          currentBook.id,
          chapterHref,
          cfiRange,
          selection.text,
          color,
        );
        setLastHighlightColor(color);
        resetSelection();
      } catch (err) {
        console.error("Failed to create highlight:", err);
      } finally {
        setIsCreating(false);
      }
    },
    [selection, currentBook, chapterHref, resetSelection],
  );

  /**
   * Handle "Highlight" action — create immediately with the last-used color
   * (no palette step). Colors can still be changed afterwards via the
   * highlight popover.
   */
  const handleHighlight = useCallback(() => {
    void handleCreateHighlight(getLastHighlightColor());
  }, [handleCreateHighlight]);

  /**
   * Submit the note with user's content.
   */
  const handleSubmitNote = useCallback(async () => {
    if (!selection || !currentBook || !noteText.trim()) return;

    setIsCreating(true);
    try {
      const cfiRange = generateCfiRange(
        chapterHref,
        selection.startOffset,
        selection.endOffset,
      );
      await createNote(
        currentBook.id,
        chapterHref,
        cfiRange,
        selection.text,
        noteText.trim(),
      );
      resetSelection();
    } catch (err) {
      console.error("Failed to create note:", err);
    } finally {
      setIsCreating(false);
    }
  }, [selection, currentBook, chapterHref, noteText, resetSelection]);

  /**
   * Cancel and dismiss everything.
   */
  const handleCancel = useCallback(() => {
    resetSelection();
  }, [resetSelection]);

  return {
    isCreating,
    handleAddNote,
    handleHighlight,
    handleCreateHighlight,
    handleSubmitNote,
    handleCancel,
  };
}
