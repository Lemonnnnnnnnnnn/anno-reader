/**
 * Annotation state hook for AnnotationPanel.
 *
 * Manages:
 * - Tab selection (notes/highlights)
 * - Note editing state
 * - Filtered and sorted annotations for current book
 */

import { useState, useMemo } from "react";
import { useBookStore } from "@/stores/useBookStore";

export type TabType = "notes" | "highlights";

export function useAnnotationState() {
  const currentBook = useBookStore((state) => state.currentBook);
  const notes = useBookStore((state) => state.notes);
  const highlights = useBookStore((state) => state.highlights);

  const [tab, setTab] = useState<TabType>("notes");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Filter annotations for the current book
  const bookNotes = currentBook
    ? notes.filter((n) => n.bookId === currentBook.id)
    : [];
  const bookHighlights = currentBook
    ? highlights.filter((h) => h.bookId === currentBook.id)
    : [];

  // Sort by creation time (newest first)
  const sortedNotes = useMemo(
    () => [...bookNotes].sort((a, b) => b.createdAt - a.createdAt),
    [bookNotes],
  );
  const sortedHighlights = useMemo(
    () => [...bookHighlights].sort((a, b) => b.createdAt - a.createdAt),
    [bookHighlights],
  );

  return {
    currentBook,
    tab,
    setTab,
    editingNoteId,
    setEditingNoteId,
    editText,
    setEditText,
    bookNotes,
    bookHighlights,
    sortedNotes,
    sortedHighlights,
  };
}
