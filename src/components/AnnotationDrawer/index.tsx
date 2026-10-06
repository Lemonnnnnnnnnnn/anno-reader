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
import { Virtuoso } from "react-virtuoso";
import { useShallow } from "zustand/react/shallow";
import { Drawer } from "@/components/primitives";
import { Search, Star, X } from "lucide-react";
import { useBookStore } from "@/stores/useBookStore";
import { NoteItem } from "./NoteItem";
import { HighlightItem } from "./HighlightItem";
import { findChapterIndex } from "./utils";
import { AnnotationDetailPanel } from "@/components/AnnotationDetailPanel";
import type { AnnotationDrawerProps, TabKey } from "./types";

export type { AnnotationDrawerProps, TabKey };

export function AnnotationDrawer({ open, onClose, onNavigate, chapters }: AnnotationDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("notes");
  const [starredOnly, setStarredOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewNoteId, setPreviewNoteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bookId = useBookStore(state => state.currentBook?.id);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const handleDraftChange = useCallback((noteId: string, text: string | undefined) => {
    setDrafts(previous => {
      const next = { ...previous };
      if (text === undefined) delete next[noteId];
      else next[noteId] = text;
      return next;
    });
  }, []);
  useEffect(() => {
    if (!open) setDrafts({});
  }, [open]);
  useEffect(() => { setDrafts({}); }, [bookId]);

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

  const starredNotes = useMemo(() => filteredNotes.filter(note => note.starred), [filteredNotes]);
  const visibleNotes = starredOnly ? starredNotes : filteredNotes;

  const filteredHighlights = useMemo(() => {
    if (!searchQuery.trim()) return sortedHighlights;
    const q = searchQuery.toLowerCase();
    return sortedHighlights.filter((h) => h.text.toLowerCase().includes(q));
  }, [sortedHighlights, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;
  const isEmpty = activeTab !== "highlights"
    ? visibleNotes.length === 0
    : filteredHighlights.length === 0;

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setSearchQuery("");
    }
  }, []);

  // Jump to the opened note's location in the book, then close the drawer so
  // the reader is visible underneath. The panel closes itself afterwards.
  const handleGoToNote = useCallback(() => {
    const note = notes.find((n) => n.id === previewNoteId);
    if (!note) return;
    const index = findChapterIndex(note.chapterHref, chapters);
    if (index === -1) return;
    onNavigate(note.chapterHref, index, note.cfiRange);
    onClose();
  }, [notes, previewNoteId, chapters, onNavigate, onClose]);

  return (
    <Drawer open={open} onClose={onClose} side="right" title="Annotations" contentClassName="flex-1 min-h-0 flex flex-col overflow-hidden p-4">
      {/* Search input */}
      <div className="flex gap-2 mb-3 shrink-0">
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
      <div className="flex gap-1 border-b border-border dark:border-border-dark mb-3 shrink-0">
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

      {activeTab === "notes" && <div className="flex justify-end mb-2 shrink-0">
        <button type="button" title={starredOnly ? "Show all notes" : "Show starred notes"} aria-label="Filter starred notes"
          aria-pressed={starredOnly} onClick={() => setStarredOnly(value => !value)}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs cursor-pointer transition-colors ${starredOnly ? "text-amber-600 dark:text-amber-400 bg-amber-500/10" : "text-text-secondary dark:text-text-secondary-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark"}`}>
          <Star size={14} className={starredOnly ? "fill-current" : ""} /><span>{starredNotes.length}</span>
        </button>
      </div>}

      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-text-muted dark:text-text-muted-dark text-sm">
            {isSearching
              ? activeTab !== "highlights"
                ? "No matching notes"
                : "No matching highlights"
              : activeTab === "notes" && starredOnly ? "No starred notes yet"
              : activeTab === "notes"
                ? "No notes yet"
                : "No highlights yet"}
          </p>
        </div>
      ) : activeTab !== "highlights" ? (
        <Virtuoso
          key={`${activeTab}-${starredOnly}-${bookId}-${searchQuery}`}
          className="flex-1 min-h-0"
          data={visibleNotes}
          computeItemKey={(_, note) => note.id}
          defaultItemHeight={150}
          increaseViewportBy={200}
          itemContent={(_, note) => (
            <div className="pb-2">
              <NoteItem
                note={note}
                onPreview={setPreviewNoteId}
                draft={drafts[note.id]}
                onDraftChange={handleDraftChange}
              />
            </div>
          )}
        />
      ) : (
        <Virtuoso
          key={`highlights-${bookId}-${searchQuery}`}
          className="flex-1 min-h-0"
          data={filteredHighlights}
          computeItemKey={(_, highlight) => highlight.id}
          defaultItemHeight={130}
          increaseViewportBy={200}
          itemContent={(_, highlight) => (
            <div className="pb-2">
              <HighlightItem
                highlight={highlight}
                onNavigate={onNavigate}
                onClose={onClose}
                chapters={chapters}
              />
            </div>
          )}
        />
      )}

      {/* Note detail overlay — always a centered modal regardless of the
          personalization setting */}
      <AnnotationDetailPanel
        noteId={previewNoteId}
        onClose={() => setPreviewNoteId(null)}
        variant="modal"
        onGoToNote={handleGoToNote}
      />
    </Drawer>
  );
}
