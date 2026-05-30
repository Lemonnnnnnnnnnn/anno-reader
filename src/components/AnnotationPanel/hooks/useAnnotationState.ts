/**
 * Annotation state hook for AnnotationPanel.
 *
 * Manages:
 * - Note editing state
 * - Filtered and sorted notes for current book
 */

import { useState, useMemo } from "react";
import { useBookStore } from "@/stores/useBookStore";

export function useAnnotationState() {
  const currentBook = useBookStore((state) => state.currentBook);
  const notes = useBookStore((state) => state.notes);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Filter notes for the current book
  const bookNotes = currentBook
    ? notes.filter((n) => n.bookId === currentBook.id)
    : [];

  // Sort by creation time (newest first)
  const sortedNotes = useMemo(
    () => [...bookNotes].sort((a, b) => b.createdAt - a.createdAt),
    [bookNotes],
  );

  return {
    currentBook,
    editingNoteId,
    setEditingNoteId,
    editText,
    setEditText,
    sortedNotes,
  };
}
