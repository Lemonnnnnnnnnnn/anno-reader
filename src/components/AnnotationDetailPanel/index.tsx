/**
 * AnnotationDetailPanel component.
 *
 * Drawer-based panel that displays full note detail with edit and delete
 * actions. Uses the Drawer component as a container for consistent
 * right-side panel behavior.
 *
 * @example
 * ```tsx
 * <AnnotationDetailPanel
 *   noteId={activeNoteId}
 *   onClose={() => setActiveNoteId(null)}
 * />
 * ```
 */

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useBookStore } from "@/stores/useBookStore";
import { Drawer } from "@/components/Drawer";
import { Button, TextArea } from "@/components/primitives";
import { Pencil, Trash2 } from "lucide-react";
import { deleteNote, updateNote } from "@/lib/annotations";

interface AnnotationDetailPanelProps {
  /** ID of the note to display, or null if closed */
  noteId: string | null;
  /** Callback when the panel should close */
  onClose: () => void;
}

export function AnnotationDetailPanel({ noteId, onClose }: AnnotationDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Get note data from store
  const note = useBookStore((state) =>
    noteId ? state.notes.find((n) => n.id === noteId) ?? null : null
  );
  const currentBook = useBookStore((state) => state.currentBook);

  // Reset state when note changes
  useEffect(() => {
    setIsEditing(false);
    setEditText("");
    setConfirmDelete(false);
  }, [noteId]);

  const handleStartEdit = useCallback(() => {
    if (!note) return;
    setEditText(note.content);
    setIsEditing(true);
  }, [note]);

  const handleSaveEdit = useCallback(async () => {
    if (!noteId || !currentBook || !editText.trim()) return;
    await updateNote(noteId, editText.trim(), currentBook.id);
    setIsEditing(false);
    setEditText("");
  }, [noteId, currentBook, editText]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditText("");
  }, []);

  const handleDelete = useCallback(async () => {
    if (!noteId || !currentBook) return;
    await deleteNote(noteId, currentBook.id);
    onClose();
  }, [noteId, currentBook, onClose]);

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

  return (
    <Drawer isOpen={!!noteId} onClose={onClose} title="Note Detail">
      {note ? (
        <div className="flex flex-col gap-4 font-serif">
          {/* Quoted original text */}
          <div className="border-l-2 border-accent dark:border-accent-dark pl-3">
            <p className="m-0 text-xs text-text-secondary dark:text-text-secondary-dark italic leading-snug overflow-hidden text-ellipsis line-clamp-3">
              &ldquo;{note.text}&rdquo;
            </p>
          </div>

          {/* Note content */}
          {isEditing ? (
            <div className="flex flex-col gap-3">
              <div className="max-h-[300px] overflow-y-auto">
                <TextArea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onSubmit={handleSaveEdit}
                  onCancel={handleCancelEdit}
                  rows={6}
                  placeholder="Write your note..."
                />
              </div>
              <div className="flex justify-end gap-2">
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
            <div className="text-sm text-text dark:text-text-dark leading-relaxed break-words markdown-note">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
            </div>
          )}

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center justify-between pt-2 border-t border-border dark:border-border-dark">
              <div className="flex items-center gap-1">
                {confirmDelete ? (
                  <>
                    <span className="text-xs text-text-secondary dark:text-text-secondary-dark mr-2">Delete this note?</span>
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

              {/* Timestamp */}
              <span className="text-[0.72rem] text-text-muted dark:text-text-muted-dark">
                {new Date(note.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}
