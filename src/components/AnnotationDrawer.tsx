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

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { Drawer, Button, TextArea } from "@/components/primitives";
import { Pencil, Trash2, Search, X } from "lucide-react";
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
    <div className="border border-border dark:border-border-dark rounded-lg bg-surface-alt dark:bg-surface-alt-dark">
      {/* Main content — clickable to navigate */}
      <button
        type="button"
        onClick={handleNavigate}
        className="w-full text-left p-3 cursor-pointer bg-transparent border-none transition-colors hover:bg-surface dark:hover:bg-surface-dark rounded-t-lg"
      >
        {/* Color indicator + text */}
        <div className="flex gap-2">
          <span
            className="w-1 shrink-0 rounded-full"
            style={{ backgroundColor: highlight.color }}
          />
          <p className="m-0 text-sm text-text dark:text-text-dark leading-relaxed overflow-hidden text-ellipsis line-clamp-3 break-words">
            {truncatedText}
          </p>
        </div>

        {/* Timestamp */}
        <span className="mt-2 block text-[0.72rem] text-text-muted dark:text-text-muted-dark">
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
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}

export function AnnotationDrawer({ open, onClose, onNavigate, chapters }: AnnotationDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("notes");
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when drawer opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Clear search when drawer closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

  // Clear search when switching tabs
  useEffect(() => {
    setSearchQuery("");
  }, [activeTab]);

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

  // Filter by search query (case-insensitive)
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return sortedNotes;
    const q = searchQuery.toLowerCase();
    return sortedNotes.filter(
      (n) => n.text.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
    );
  }, [sortedNotes, searchQuery]);

  const filteredHighlights = useMemo(() => {
    if (!searchQuery.trim()) return sortedHighlights;
    const q = searchQuery.toLowerCase();
    return sortedHighlights.filter((h) => h.text.toLowerCase().includes(q));
  }, [sortedHighlights, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;
  const isEmpty = activeTab === "notes"
    ? filteredNotes.length === 0
    : filteredHighlights.length === 0;

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setSearchQuery("");
    }
  }, []);

  return (
    <Drawer open={open} onClose={onClose} side="right" title="Annotations">
      {/* Search input */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted dark:text-text-muted-dark pointer-events-none"
          />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search annotations..."
            className="w-full pl-8 pr-8 py-2 text-sm border border-border dark:border-border-dark rounded-md bg-surface dark:bg-surface-dark text-text dark:text-text-dark placeholder:text-text-muted dark:placeholder:text-text-muted-dark focus:outline-none focus:border-accent dark:focus:border-accent-dark"
          />
          {isSearching && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-text-muted dark:text-text-muted-dark hover:text-text dark:hover:text-text-dark bg-transparent border-none cursor-pointer transition-colors"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border dark:border-border-dark mb-3">
        <button
          type="button"
          onClick={() => setActiveTab("notes")}
          className={`px-3 py-1.5 text-sm border-none cursor-pointer transition-colors ${
            activeTab === "notes"
              ? "border-b-2 border-accent dark:border-accent-dark text-accent dark:text-accent-dark font-medium bg-transparent"
              : "bg-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark"
          }`}
        >
          Notes ({filteredNotes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("highlights")}
          className={`px-3 py-1.5 text-sm border-none cursor-pointer transition-colors ${
            activeTab === "highlights"
              ? "border-b-2 border-accent dark:border-accent-dark text-accent dark:text-accent-dark font-medium bg-transparent"
              : "bg-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark"
          }`}
        >
          Highlights ({filteredHighlights.length})
        </button>
      </div>

      {isEmpty ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-text-muted dark:text-text-muted-dark text-sm">
            {isSearching
              ? activeTab === "notes"
                ? "No matching notes"
                : "No matching highlights"
              : activeTab === "notes"
                ? "No notes yet"
                : "No highlights yet"}
          </p>
        </div>
      ) : activeTab === "notes" ? (
        <div className="flex flex-col gap-2">
          {filteredNotes.map((note) => (
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
          {filteredHighlights.map((highlight) => (
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
