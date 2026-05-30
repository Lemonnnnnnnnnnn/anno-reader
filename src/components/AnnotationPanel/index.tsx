/**
 * AnnotationPanel component.
 *
 * Side panel that displays notes for the current book.
 * Provides management UI for editing note content and deleting notes.
 *
 * @example
 * ```tsx
 * <AnnotationPanel />
 * ```
 */

import { Button, TextArea, Icon } from "@/components/primitives";
import { useAnnotationState, useAnnotationActions } from "./hooks";
import { truncate, formatTime } from "./utils";

interface AnnotationPanelProps {
  /** Map of noteId → vertical offset in the chapter iframe */
  notePositions?: Map<string, number>;
  /** Total scrollable height of the chapter document */
  docHeight?: number;
  /** Current vertical scroll offset of the chapter iframe */
  scrollTop?: number;
}

export function AnnotationPanel({ notePositions, docHeight, scrollTop }: AnnotationPanelProps) {
  const {
    currentBook,
    editingNoteId,
    setEditingNoteId,
    editText,
    setEditText,
    sortedNotes,
  } = useAnnotationState();

  const {
    handleDeleteNote,
    handleStartEdit,
    handleSaveEdit,
    handleCancelEdit,
  } = useAnnotationActions({
    currentBook,
    editingNoteId,
    editText,
    setEditingNoteId,
    setEditText,
  });

  return (
    <div className="h-full w-full bg-surface border-l border-border flex flex-col font-serif">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <h2 className="m-0 text-base font-semibold text-text tracking-tight">
          Notes
        </h2>
      </div>

      {/* Content - positioned notes matching body layout */}
      {notePositions ? (
        <div
          className="relative overflow-hidden flex-1"
          style={{ height: docHeight || "100%", marginTop: -(scrollTop || 0) }}
        >
          {sortedNotes.map((note) => {
            const top = notePositions.get(note.id);
            if (top === undefined) return null;
            return (
              <div
                key={note.id}
                className="absolute left-2 right-2 p-3 bg-surface border border-border rounded-lg shadow-sm"
                style={{ top }}
              >
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
            );
          })}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {sortedNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-6 text-center gap-1">
              <p className="m-0 text-sm font-medium text-text-secondary">
                No notes yet
              </p>
              <p className="m-0 text-xs text-text-muted leading-relaxed">
                Select text in the chapter and click &ldquo;Note&rdquo; to add one
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
        </div>
      )}
    </div>
  );
}
