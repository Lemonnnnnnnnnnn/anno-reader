/**
 * AnnotationPopover component.
 *
 * Lightweight floating popover that displays note content when
 * annotated text is clicked in the EPUB iframe. Provides edit
 * and delete actions for the note.
 *
 * Positioned to the right of the content area, vertically aligned
 * with the clicked text.
 *
 * @example
 * ```tsx
 * <AnnotationPopover
 *   noteId={activeNoteId}
 *   position={popoverPosition}
 *   onClose={() => setActiveNoteId(null)}
 * />
 * ```
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useBookStore } from "@/stores/useBookStore";
import { Button, TextArea, Icon } from "@/components/primitives";
import { deleteNote, updateNote } from "@/lib/annotations";

interface PopoverPosition {
  /** Vertical center position relative to the content area */
  top: number;
}

interface AnnotationPopoverProps {
  /** ID of the note to display, or null if closed */
  noteId: string | null;
  /** Position for the popover, or null if closed */
  position: PopoverPosition | null;
  /** Callback when the popover should close */
  onClose: () => void;
}

export function AnnotationPopover({ noteId, position, onClose }: AnnotationPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");

  // Get note data from store
  const note = useBookStore((state) =>
    noteId ? state.notes.find((n) => n.id === noteId) ?? null : null
  );
  const currentBook = useBookStore((state) => state.currentBook);

  // Reset editing state when note changes
  useEffect(() => {
    setIsEditing(false);
    setEditText("");
  }, [noteId]);

  // Close on Escape key
  useEffect(() => {
    if (!noteId) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [noteId, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!noteId) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay to avoid closing on the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [noteId, onClose]);

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

  if (!noteId || !note || !position) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 w-[280px] bg-surface border border-border rounded-lg shadow-lg overflow-hidden font-serif"
      style={{
        top: position.top,
        right: 16,
        transform: "translateY(-50%)",
      }}
    >
      {/* Quoted selected text */}
      <div className="px-3 pt-3 pb-2 border-b border-border flex items-start gap-2">
        <p className="m-0 text-xs text-text-secondary italic leading-snug overflow-hidden text-ellipsis line-clamp-3 flex-1">
          &ldquo;{note.text}&rdquo;
        </p>
        <Button
          variant="icon"
          onClick={onClose}
          title="Close"
          className="shrink-0 -mt-0.5"
        >
          <Icon name="close" size={14} />
        </Button>
      </div>

      {/* Note content */}
      <div className="px-3 py-2">
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <TextArea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onSubmit={handleSaveEdit}
              onCancel={handleCancelEdit}
              rows={3}
              placeholder="Write your note..."
            />
            <div className="flex justify-end gap-1.5">
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
          <p className="m-0 text-sm text-text leading-relaxed break-words">
            {note.content}
          </p>
        )}
      </div>

      {/* Actions */}
      {!isEditing && (
        <div className="flex items-center justify-end gap-0.5 px-2 pb-2">
          <Button
            variant="icon"
            onClick={handleStartEdit}
            title="Edit note"
          >
            <Icon name="edit" size={14} />
          </Button>
          <Button
            variant="icon"
            onClick={handleDelete}
            title="Delete note"
          >
            <Icon name="trash" size={14} />
          </Button>
        </div>
      )}

      {/* Timestamp */}
      <div className="px-3 pb-2 border-t border-border">
        <span className="text-[0.72rem] text-text-muted">
          {new Date(note.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
