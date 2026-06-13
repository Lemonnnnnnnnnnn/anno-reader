import { useState, useCallback } from "react";
import { Button, TextArea } from "@/components/primitives";
import { Pencil, Trash2 } from "lucide-react";
import { deleteNote, updateNote } from "@/lib/annotations";
import { formatTimestamp, findChapterIndex } from "./utils";
import type { NoteItemProps } from "./types";

/** Single note card inside the drawer with edit/delete actions. */
export function NoteItem({ note, onNavigate, onClose, chapters }: NoteItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");

  const truncatedText =
    note.text.length > 50 ? `${note.text.slice(0, 50)}\u2026` : note.text;

  const handleNavigate = useCallback(() => {
    const index = findChapterIndex(note.chapterHref, chapters);
    if (index !== -1) {
      onNavigate(note.chapterHref, index, note.cfiRange);
      onClose();
    }
  }, [note.chapterHref, note.cfiRange, chapters, onNavigate, onClose]);

  const handleStartEdit = useCallback(() => {
    setEditText(note.content);
    setIsEditing(true);
  }, [note.content]);

  const handleSaveEdit = useCallback(async () => {
    await updateNote(note.id, editText.trim(), note.bookId);
    setIsEditing(false);
    setEditText("");
  }, [note.id, note.bookId, editText]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditText("");
  }, []);

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNote(note.id, note.bookId);
  }, [note.id, note.bookId]);

  return (
    <div className="border border-border dark:border-border-dark rounded-lg bg-surface-alt dark:bg-surface-alt-dark">
      {/* Main content — clickable to navigate */}
      <button
        type="button"
        onClick={handleNavigate}
        className="w-full text-left p-3 cursor-pointer bg-transparent border-none transition-colors hover:bg-surface dark:hover:bg-surface-dark rounded-t-lg"
      >
        {/* Quoted text */}
        <p className="m-0 text-xs text-text-secondary dark:text-text-secondary-dark italic leading-snug overflow-hidden text-ellipsis line-clamp-2">
          &ldquo;{truncatedText}&rdquo;
        </p>

        {/* Note content preview */}
        {!isEditing && note.content && (
          <p className="mt-1.5 m-0 text-sm text-text dark:text-text-dark leading-relaxed line-clamp-2 break-words">
            {note.content}
          </p>
        )}

        {/* Timestamp */}
        <span className="mt-2 block text-[0.72rem] text-text-muted dark:text-text-muted-dark">
          {formatTimestamp(note.createdAt)}
        </span>
      </button>

      {/* Edit mode */}
      {isEditing && (
        <div className="px-3 pb-3 flex flex-col gap-2">
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
      )}

      {/* Action buttons */}
      {!isEditing && (
        <div className="flex items-center justify-end gap-0.5 px-2 pb-2">
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
    </div>
  );
}
