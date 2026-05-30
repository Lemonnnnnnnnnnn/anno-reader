/**
 * AnnotationPanel component.
 *
 * Side panel that displays all notes and highlights for the current book.
 * Provides management UI for editing note content and deleting annotations.
 *
 * @example
 * ```tsx
 * <AnnotationPanel open={true} onClose={() => setOpen(false)} />
 * ```
 */

import { useState, useCallback } from "react";
import { useBookStore, type Note } from "@/stores/useBookStore";
import {
  deleteNote,
  updateNote,
  deleteHighlight,
} from "@/lib/annotations";
import { Button, TextArea, Icon } from "@/components/primitives";

interface AnnotationPanelProps {
  /** Whether the panel is visible */
  open: boolean;
  /** Callback to close the panel */
  onClose: () => void;
}

type TabType = "notes" | "highlights";

export function AnnotationPanel({ open, onClose }: AnnotationPanelProps) {
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
  const sortedNotes = [...bookNotes].sort((a, b) => b.createdAt - a.createdAt);
  const sortedHighlights = [...bookHighlights].sort(
    (a, b) => b.createdAt - a.createdAt,
  );

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

  const handleStartEdit = useCallback((note: Note) => {
    setEditingNoteId(note.id);
    setEditText(note.content);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingNoteId || !currentBook) return;
    await updateNote(editingNoteId, editText, currentBook.id);
    setEditingNoteId(null);
    setEditText("");
  }, [editingNoteId, editText, currentBook]);

  const handleCancelEdit = useCallback(() => {
    setEditingNoteId(null);
    setEditText("");
  }, []);

  if (!open) return null;

  return (
    <>
      {/* Backdrop — click outside to close */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[340px] max-w-[90vw] bg-surface border-l border-border shadow-lg z-50 flex flex-col font-serif">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="m-0 text-base font-semibold text-text tracking-tight">
            Annotations
          </h2>
          <Button variant="icon" onClick={onClose} title="Close">
            <Icon name="close" size={16} />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          <button
            className={`flex-1 py-2 text-sm font-medium text-center cursor-pointer bg-transparent border-none border-b-2 transition-colors ${
              tab === "notes"
                ? "text-text border-b-accent"
                : "text-text-secondary border-b-transparent"
            }`}
            onClick={() => setTab("notes")}
          >
            Notes ({bookNotes.length})
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium text-center cursor-pointer bg-transparent border-none border-b-2 transition-colors ${
              tab === "highlights"
                ? "text-text border-b-accent"
                : "text-text-secondary border-b-transparent"
            }`}
            onClick={() => setTab("highlights")}
          >
            Highlights ({bookHighlights.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "notes" && (
            <>
              {sortedNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-6 text-center gap-1">
                  <p className="m-0 text-sm font-medium text-text-secondary">
                    No notes yet
                  </p>
                  <p className="m-0 text-xs text-text-muted leading-relaxed">
                    Select text in the chapter and click &ldquo;Note&rdquo; to
                    add one
                  </p>
                </div>
              ) : (
                sortedNotes.map((note) => (
                  <div key={note.id} className="p-4 border-b border-border">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs text-text-secondary italic leading-snug flex-1 min-w-0 overflow-hidden text-ellipsis line-clamp-2">
                        &ldquo;{truncate(note.text, 60)}&rdquo;
                      </span>
                      <div className="flex gap-0.5 shrink-0">
                        <Button
                          variant="icon"
                          onClick={() => handleStartEdit(note)}
                          title="Edit note"
                        >
                          <Icon name="edit" size={14} />
                        </Button>
                        <Button
                          variant="icon"
                          onClick={() => handleDeleteNote(note.id)}
                          title="Delete note"
                        >
                          <Icon name="trash" size={14} />
                        </Button>
                      </div>
                    </div>
                    {editingNoteId === note.id ? (
                      <div className="flex flex-col gap-2 mt-1">
                        <TextArea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onSubmit={handleSaveEdit}
                          onCancel={handleCancelEdit}
                          rows={3}
                        />
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSaveEdit}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="m-0 text-[0.85rem] text-text leading-relaxed break-words">
                        {note.content}
                      </p>
                    )}
                    <span className="block text-[0.72rem] text-text-muted mt-1">
                      {formatTime(note.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </>
          )}

          {tab === "highlights" && (
            <>
              {sortedHighlights.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-6 text-center gap-1">
                  <p className="m-0 text-sm font-medium text-text-secondary">
                    No highlights yet
                  </p>
                  <p className="m-0 text-xs text-text-muted leading-relaxed">
                    Select text in the chapter and click &ldquo;Highlight&rdquo;
                    to add one
                  </p>
                </div>
              ) : (
                sortedHighlights.map((hl) => (
                  <div key={hl.id} className="p-4 border-b border-border">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        {/* Dynamic color requires inline style */}
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-border"
                          style={{ backgroundColor: hl.color }}
                        />
                        <span className="text-xs text-text-secondary italic leading-snug flex-1 min-w-0 overflow-hidden text-ellipsis line-clamp-2">
                          &ldquo;{truncate(hl.text, 60)}&rdquo;
                        </span>
                      </div>
                      <Button
                        variant="icon"
                        onClick={() => handleDeleteHighlight(hl.id)}
                        title="Delete highlight"
                      >
                        <Icon name="trash" size={14} />
                      </Button>
                    </div>
                    <span className="block text-[0.72rem] text-text-muted mt-1">
                      {formatTime(hl.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** Truncate text to a max length with ellipsis */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\u2026";
}

/** Format timestamp to a readable date string */
function formatTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
