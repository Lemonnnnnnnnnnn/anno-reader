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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useBookStore } from "@/stores/useBookStore";
import { Button, TextArea } from "@/components/primitives";
import { X, Pencil, Trash2 } from "lucide-react";
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
      className="absolute z-50 w-96 max-h-[calc(100vh-4rem)] bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg shadow-lg overflow-hidden font-serif flex flex-col"
      style={{
        top: position.top,
        right: 16,
        transform: "translateY(-50%)",
      }}
    >
      {/* Quoted selected text */}
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-border dark:border-border-dark flex items-start gap-2">
        <p className="m-0 text-xs text-text-secondary dark:text-text-secondary-dark italic leading-snug overflow-hidden text-ellipsis line-clamp-3 flex-1">
          &ldquo;{note.text}&rdquo;
        </p>
        <Button
          variant="icon"
          onClick={onClose}
          title="Close"
          className="shrink-0 -mt-0.5"
        >
          <X size={14} />
        </Button>
      </div>

      {/* Note content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
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
          <div className="m-0 text-sm text-text leading-relaxed break-words markdown-note">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Actions */}
      {!isEditing && (
        <div className="shrink-0 flex items-center justify-end gap-0.5 px-2 pb-2">
          <Button
            variant="icon"
            onClick={handleStartEdit}
            title="Edit note"
          >
            <Pencil size={14} />
          </Button>
          <Button
            variant="icon"
            onClick={handleDelete}
            title="Delete note"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      )}

      {/* Timestamp */}
      <div className="shrink-0 px-3 pb-2 border-t border-border dark:border-border-dark">
        <span className="text-[0.72rem] text-text-muted dark:text-text-muted-dark">
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
