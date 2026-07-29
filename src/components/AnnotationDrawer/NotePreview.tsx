/**
 * NotePreview component.
 *
 * Quick full-content preview of a single note, opened from a card in the
 * Annotations drawer. Reuses the Drawer primitive as an overlay. Supports
 * edit, delete (with confirmation), and a "Go to note" action that jumps to
 * the note's location in the book.
 *
 * @example
 * ```tsx
 * <NotePreview
 *   previewNoteId={previewNoteId}
 *   onClose={() => setPreviewNoteId(null)}
 *   onNavigate={onNavigate}
 *   onDrawerClose={onClose}
 *   chapters={chapters}
 * />
 * ```
 */

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useBookStore } from "@/stores/useBookStore";
import { Drawer, Button, TextArea } from "@/components/primitives";
import { Pencil, Trash2, CornerDownRight } from "lucide-react";
import { deleteNote, updateNote } from "@/lib/annotations";
import { formatTimestamp, findChapterIndex } from "./utils";
import type { NotePreviewProps } from "./types";

export function NotePreview({
  previewNoteId,
  onClose,
  onNavigate,
  onDrawerClose,
  chapters,
}: NotePreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Look up the note from the store so it stays fresh after edits
  const note = useBookStore((state) =>
    previewNoteId
      ? state.notes.find((n) => n.id === previewNoteId) ?? null
      : null,
  );
  const currentBook = useBookStore((state) => state.currentBook);

  // Reset transient state when the previewed note changes / closes
  useEffect(() => {
    setIsEditing(false);
    setEditText("");
    setConfirmDelete(false);
  }, [previewNoteId]);

  const handleStartEdit = useCallback(() => {
    if (!note) return;
    setEditText(note.content);
    setIsEditing(true);
  }, [note]);

  const handleSaveEdit = useCallback(async () => {
    if (!previewNoteId || !currentBook || !editText.trim()) return;
    await updateNote(previewNoteId, editText.trim(), currentBook.id);
    setIsEditing(false);
    setEditText("");
  }, [previewNoteId, currentBook, editText]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditText("");
  }, []);

  const handleDelete = useCallback(async () => {
    if (!previewNoteId || !currentBook) return;
    await deleteNote(previewNoteId, currentBook.id);
    onClose();
  }, [previewNoteId, currentBook, onClose]);

  const handleDeleteClick = useCallback(() => {
    if (confirmDelete) {
      handleDelete();
    } else {
      setConfirmDelete(true);
    }
  }, [confirmDelete, handleDelete]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDelete(false);
  }, []);

  // Jump to the note's location in the book, then close the preview and the
  // parent list drawer so the reader is visible underneath.
  const handleGoToNote = useCallback(() => {
    if (!note) return;
    const index = findChapterIndex(note.chapterHref, chapters);
    if (index === -1) return;
    onNavigate(note.chapterHref, index, note.cfiRange);
    onClose();
    onDrawerClose();
  }, [note, chapters, onNavigate, onClose, onDrawerClose]);

  if (!note) return null;

  return (
    <Drawer
      open={!!previewNoteId}
      onClose={onClose}
      title="Note Preview"
      closeOnOutsideClick={!isEditing}
    >
      <div className="flex-1 flex flex-col gap-4 font-serif min-h-0 h-full">
        {/* Quoted original text (full) */}
        <div className="border-l-2 border-accent dark:border-accent-dark pl-3">
          <p className="m-0 text-xs text-text-secondary dark:text-text-secondary-dark italic leading-snug break-words">
            &ldquo;{note.text}&rdquo;
          </p>
        </div>

        {/* Note content (full, Markdown rendered) */}
        {isEditing ? (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <TextArea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onSubmit={handleSaveEdit}
              onCancel={handleCancelEdit}
              className="flex-1 min-h-0"
              placeholder="Write your note..."
            />
            <div className="flex justify-end gap-2 shrink-0">
              <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveEdit}
                disabled={!editText.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto text-sm text-text dark:text-text-dark leading-relaxed break-words markdown-note">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {note.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Actions */}
        {!isEditing && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border dark:border-border-dark shrink-0">
            <div className="flex items-center gap-1">
              {confirmDelete ? (
                <>
                  <span className="text-xs text-text-secondary dark:text-text-secondary-dark mr-2">
                    Delete this note?
                  </span>
                  <Button variant="secondary" size="sm" onClick={handleCancelDelete}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleDeleteClick}>
                    Delete
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="icon"
                    onClick={handleStartEdit}
                    title="Edit note"
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="icon"
                    onClick={handleDeleteClick}
                    title="Delete note"
                  >
                    <Trash2 size={16} />
                  </Button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[0.72rem] text-text-muted dark:text-text-muted-dark">
                {formatTimestamp(note.createdAt)}
              </span>
              <Button variant="secondary" size="sm" onClick={handleGoToNote} title="Go to note in book">
                <CornerDownRight size={14} />
                <span className="ml-1">Go to note</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
