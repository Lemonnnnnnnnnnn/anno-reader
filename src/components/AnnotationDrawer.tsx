/**
 * AnnotationDrawer component.
 *
 * Side drawer that lists all annotations (notes) for the current book.
 * Uses the Drawer primitive for layout and animation, with notes
 * filtered from the Zustand store via `useShallow` to prevent
 * infinite re-render loops.
 *
 * @example
 * ```tsx
 * <AnnotationDrawer
 *   open={isDrawerOpen}
 *   onClose={() => setIsDrawerOpen(false)}
 * />
 * ```
 */

import { useState, useMemo, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { Drawer, Button, Icon, TextArea } from "@/components/primitives";
import { useBookStore, type Note, type Highlight } from "@/stores/useBookStore";
import { deleteNote, updateNote, deleteHighlight } from "@/lib/annotations";
import type { EpubChapterInfo } from "@/lib/epub/types";

type TabKey = "notes" | "highlights";

interface AnnotationDrawerProps {
  /** Whether the drawer is visible */
  open: boolean;
  /** Callback when the drawer should close */
  onClose: () => void;
  /** Callback to navigate to a chapter (href, index, cfiRange?) */
  onNavigate: (href: string, index: number, cfiRange?: string) => void;
  /** All chapters for href-to-index resolution */
  chapters: EpubChapterInfo[];
}

/**
 * Format a timestamp into a short human-readable string.
 * Example: "May 31, 10:30 AM"
 */
function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Strip fragment identifier from href (e.g., "chapter1.html#sec2" -> "chapter1.html") */
function stripFragment(href: string): string {
  return href.split("#")[0];
}

/** Find the chapter index matching a given href */
function findChapterIndex(
  href: string,
  chapters: EpubChapterInfo[],
): number {
  const stripped = stripFragment(href);
  return chapters.findIndex((ch) => ch.href === stripped);
}

interface NoteItemProps {
  note: Note;
  onNavigate: (href: string, index: number, cfiRange?: string) => void;
  onClose: () => void;
  chapters: EpubChapterInfo[];
}

/** Single note card inside the drawer with edit/delete actions. */
function NoteItem({ note, onNavigate, onClose, chapters }: NoteItemProps) {
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
    <div className="border border-border rounded-lg bg-surface-alt">
      {/* Main content — clickable to navigate */}
      <button
        type="button"
        onClick={handleNavigate}
        className="w-full text-left p-3 cursor-pointer bg-transparent border-none transition-colors hover:bg-surface rounded-t-lg"
      >
        {/* Quoted text */}
        <p className="m-0 text-xs text-text-secondary italic leading-snug overflow-hidden text-ellipsis line-clamp-2">
          &ldquo;{truncatedText}&rdquo;
        </p>

        {/* Note content preview */}
        {!isEditing && note.content && (
          <p className="mt-1.5 m-0 text-sm text-text leading-relaxed line-clamp-2 break-words">
            {note.content}
          </p>
        )}

        {/* Timestamp */}
        <span className="mt-2 block text-[0.72rem] text-text-muted">
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
    </div>
  );
}

interface HighlightItemProps {
  highlight: Highlight;
  onNavigate: (href: string, index: number, cfiRange?: string) => void;
  onClose: () => void;
  chapters: EpubChapterInfo[];
}

/** Single highlight card inside the drawer with delete action. */
function HighlightItem({ highlight, onNavigate, onClose, chapters }: HighlightItemProps) {
  const truncatedText =
    highlight.text.length > 80 ? `${highlight.text.slice(0, 80)}\u2026` : highlight.text;

  const handleNavigate = useCallback(() => {
    const index = findChapterIndex(highlight.chapterHref, chapters);
    if (index !== -1) {
      onNavigate(highlight.chapterHref, index, highlight.cfiRange);
      onClose();
    }
  }, [highlight.chapterHref, highlight.cfiRange, chapters, onNavigate, onClose]);

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteHighlight(highlight.id, highlight.bookId);
  }, [highlight.id, highlight.bookId]);

  return (
    <div className="border border-border rounded-lg bg-surface-alt">
      {/* Main content — clickable to navigate */}
      <button
        type="button"
        onClick={handleNavigate}
        className="w-full text-left p-3 cursor-pointer bg-transparent border-none transition-colors hover:bg-surface rounded-t-lg"
      >
        {/* Color indicator + text */}
        <div className="flex gap-2">
          <span
            className="w-1 shrink-0 rounded-full"
            style={{ backgroundColor: highlight.color }}
          />
          <p className="m-0 text-sm text-text leading-relaxed overflow-hidden text-ellipsis line-clamp-3 break-words">
            {truncatedText}
          </p>
        </div>

        {/* Timestamp */}
        <span className="mt-2 block text-[0.72rem] text-text-muted">
          {formatTimestamp(highlight.createdAt)}
        </span>
      </button>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-0.5 px-2 pb-2">
        <Button
          variant="icon"
          onClick={handleDelete}
          title="Delete highlight"
        >
          <Icon name="trash" size={14} />
        </Button>
      </div>
    </div>
  );
}

export function AnnotationDrawer({ open, onClose, onNavigate, chapters }: AnnotationDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("notes");

  // Use useShallow to avoid infinite re-render loop when filtering arrays
  const notes = useBookStore(
    useShallow((state) => {
      const bookId = state.currentBook?.id;
      return bookId
        ? state.notes.filter((n) => n.bookId === bookId)
        : [];
    }),
  );

  const highlights = useBookStore(
    useShallow((state) => {
      const bookId = state.currentBook?.id;
      return bookId
        ? state.highlights.filter((h) => h.bookId === bookId)
        : [];
    }),
  );

  // Sort newest-first
  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => b.createdAt - a.createdAt),
    [notes],
  );
  const sortedHighlights = useMemo(
    () => [...highlights].sort((a, b) => b.createdAt - a.createdAt),
    [highlights],
  );

  const isEmpty = activeTab === "notes"
    ? sortedNotes.length === 0
    : sortedHighlights.length === 0;

  return (
    <Drawer open={open} onClose={onClose} side="right" title="Annotations">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border mb-3">
        <button
          type="button"
          onClick={() => setActiveTab("notes")}
          className={`px-3 py-1.5 text-sm border-none cursor-pointer transition-colors ${
            activeTab === "notes"
              ? "border-b-2 border-accent text-accent font-medium bg-transparent"
              : "bg-transparent text-text-secondary hover:text-text"
          }`}
        >
          Notes ({sortedNotes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("highlights")}
          className={`px-3 py-1.5 text-sm border-none cursor-pointer transition-colors ${
            activeTab === "highlights"
              ? "border-b-2 border-accent text-accent font-medium bg-transparent"
              : "bg-transparent text-text-secondary hover:text-text"
          }`}
        >
          Highlights ({sortedHighlights.length})
        </button>
      </div>

      {isEmpty ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-text-muted text-sm">
            {activeTab === "notes" ? "No notes yet" : "No highlights yet"}
          </p>
        </div>
      ) : activeTab === "notes" ? (
        <div className="flex flex-col gap-2">
          {sortedNotes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              onNavigate={onNavigate}
              onClose={onClose}
              chapters={chapters}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sortedHighlights.map((highlight) => (
            <HighlightItem
              key={highlight.id}
              highlight={highlight}
              onNavigate={onNavigate}
              onClose={onClose}
              chapters={chapters}
            />
          ))}
        </div>
      )}
    </Drawer>
  );
}
