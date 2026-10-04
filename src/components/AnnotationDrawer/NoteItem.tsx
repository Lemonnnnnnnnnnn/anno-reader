import { memo, useCallback } from "react";
import { Button, TextArea } from "@/components/primitives";
import { Pencil, Trash2 } from "lucide-react";
import { deleteNote, updateNote } from "@/lib/annotations";
import { formatTimestamp } from "./utils";
import type { NoteItemProps } from "./types";

/** Single note card inside the drawer with edit/delete actions. */
export const NoteItem = memo(function NoteItem({ note, onPreview, draft, onDraftChange }: NoteItemProps) {
  const isEditing = draft !== undefined;
  const editText = draft ?? "";

  const truncatedText =
    note.text.length > 50 ? `${note.text.slice(0, 50)}\u2026` : note.text;

  const handlePreview = useCallback(() => {
    onPreview(note.id);
  }, [note.id, onPreview]);

  const handleStartEdit = useCallback(() => {
    onDraftChange(note.id, note.content);
  }, [note.id, note.content, onDraftChange]);

  const handleSaveEdit = useCallback(async () => {
    await updateNote(note.id, editText.trim(), note.bookId);
    onDraftChange(note.id, undefined);
  }, [note.id, note.bookId, editText, onDraftChange]);

  const handleCancelEdit = useCallback(() => {
    onDraftChange(note.id, undefined);
  }, [note.id, onDraftChange]);

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNote(note.id, note.bookId);
    onDraftChange(note.id, undefined);
  }, [note.id, note.bookId, onDraftChange]);

  return (
    <div className="border border-border dark:border-border-dark rounded-lg bg-surface-alt dark:bg-surface-alt-dark">
      {/* Main content — clickable to open the full-content preview */}
      <button
        type="button"
        onClick={handlePreview}
        className="w-full text-left p-3 cursor-pointer bg-transparent border-none transition-colors hover:bg-surface dark:hover:bg-surface-dark rounded-t-lg"
      >
        {/* Quoted text */}
        <p className="m-0 text-xs text-text-secondary dark:text-text-secondary-dark italic leading-snug overflow-hidden text-ellipsis line-clamp-2">
          &ldquo;{truncatedText}&rdquo;
        </p>

        {/* Note content preview */}
        {!isEditing && note.content && (
          <p className="mt-1.5 m-0 text-sm text-text dark:text-text-dark leading-relaxed line-clamp-2 break-words">
            {note.content.length > 240 ? `${note.content.slice(0, 240)}\u2026` : note.content}
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
            onChange={(e) => onDraftChange(note.id, e.target.value)}
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
});
