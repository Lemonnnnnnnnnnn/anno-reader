/**
 * Annotation actions hook for AnnotationPanel.
 *
 * Handles:
 * - Deleting notes and highlights
 * - Editing notes (start, save, cancel)
 */

import { useCallback } from "react";
import type { Note } from "@/stores/useBookStore";
import { deleteNote, updateNote, deleteHighlight } from "@/lib/annotations";

interface UseAnnotationActionsParams {
  currentBook: { id: string } | null;
  editingNoteId: string | null;
  editText: string;
  setEditingNoteId: (id: string | null) => void;
  setEditText: (text: string) => void;
}

export function useAnnotationActions({
  currentBook,
  editingNoteId,
  editText,
  setEditingNoteId,
  setEditText,
}: UseAnnotationActionsParams) {
  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      if (!currentBook) return;
      await deleteNote(noteId, currentBook.id);
    },
    [currentBook],
  );

  const handleDeleteHighlight = useCallback(
    async (highlightId: string) => {
      if (!currentBook) return;
      await deleteHighlight(highlightId, currentBook.id);
    },
    [currentBook],
  );

  const handleStartEdit = useCallback(
    (note: Note) => {
      setEditingNoteId(note.id);
      setEditText(note.content);
    },
    [setEditingNoteId, setEditText],
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editingNoteId || !currentBook) return;
    await updateNote(editingNoteId, editText, currentBook.id);
    setEditingNoteId(null);
    setEditText("");
  }, [editingNoteId, editText, currentBook, setEditingNoteId, setEditText]);

  const handleCancelEdit = useCallback(() => {
    setEditingNoteId(null);
    setEditText("");
  }, [setEditingNoteId, setEditText]);

  return {
    handleDeleteNote,
    handleDeleteHighlight,
    handleStartEdit,
    handleSaveEdit,
    handleCancelEdit,
  };
}
