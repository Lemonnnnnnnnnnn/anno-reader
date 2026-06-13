/**
 * Notes & Highlights module for EPUB reader.
 *
 * Provides functions for creating, managing, and persisting notes and highlights.
 * Integrates with the Zustand store for reactive state management and uses
 * Tauri's filesystem plugin for JSON-based persistence.
 *
 * @example
 * ```ts
 * import {
 *   createNote, deleteNote, updateNote, getNotesForChapter, restoreNotes,
 *   createHighlight, deleteHighlight, updateHighlight, getHighlightsForChapter, restoreHighlights,
 * } from "@/lib/annotations";
 *
 * // When opening a book, restore saved notes & highlights
 * await restoreNotes(bookId);
 * await restoreHighlights(bookId);
 *
 * // Create a highlight from text selection
 * const highlight = await createHighlight(bookId, chapterHref, cfiRange, selectedText, "#ffeb3b");
 *
 * // Create a note from text selection
 * const note = await createNote(bookId, chapterHref, cfiRange, selectedText, "My note");
 *
 * // Get highlights for a specific chapter
 * const chapterHighlights = getHighlightsForChapter(chapterHref);
 *
 * // Delete a highlight
 * await deleteHighlight(highlightId, bookId);
 * ```
 */

import { useBookStore, type Note, type Highlight } from "@/stores/useBookStore";
import type { ContentRef } from "@/lib/content/types";
import {
  loadNotesFromFile,
  saveNotesToFile,
  deleteNotesFile,
  loadHighlightsFromFile,
  saveHighlightsToFile,
  deleteHighlightsFile,
} from "./persistence";
import type { NoteData, HighlightData } from "./types";
import {
  findOverlappingHighlights,
  mergeRanges,
  parseCfiRange,
} from "./overlap";

/**
 * Generate a unique ID for a note.
 */
function generateNoteId(): string {
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Convert store Note to persistable NoteData.
 */
function toNoteData(note: Note): NoteData {
  return {
    id: note.id,
    bookId: note.bookId,
    chapterHref: note.chapterHref,
    cfiRange: note.cfiRange,
    text: note.text,
    content: note.content,
    createdAt: new Date(note.createdAt).toISOString(),
    updatedAt: new Date().toISOString(),
    contentRef: note.contentRef,
  };
}

/**
 * Convert persisted NoteData to store Note.
 */
function toStoreNote(data: NoteData): Note {
  return {
    id: data.id,
    bookId: data.bookId,
    chapterHref: data.chapterHref,
    cfiRange: data.cfiRange,
    text: data.text,
    content: data.content,
    createdAt: new Date(data.createdAt).getTime(),
    contentRef: data.contentRef,
  };
}

/**
 * Generate a unique ID for a highlight.
 */
function generateHighlightId(): string {
  return `hl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Convert store Highlight to persistable HighlightData.
 */
function toHighlightData(highlight: Highlight): HighlightData {
  return {
    id: highlight.id,
    bookId: highlight.bookId,
    chapterHref: highlight.chapterHref,
    cfiRange: highlight.cfiRange,
    text: highlight.text,
    color: highlight.color,
    createdAt: new Date(highlight.createdAt).toISOString(),
    contentRef: highlight.contentRef,
  };
}

/**
 * Convert persisted HighlightData to store Highlight.
 */
function toStoreHighlight(data: HighlightData): Highlight {
  return {
    id: data.id,
    bookId: data.bookId,
    chapterHref: data.chapterHref,
    cfiRange: data.cfiRange,
    text: data.text,
    color: data.color,
    createdAt: new Date(data.createdAt).getTime(),
    contentRef: data.contentRef,
  };
}

/**
 * Persist all notes for the current book to disk.
 */
async function persistNotes(bookId: string): Promise<void> {
  const { notes } = useBookStore.getState();
  const bookNotes = notes.filter((n) => n.bookId === bookId);
  const noteData = bookNotes.map(toNoteData);
  await saveNotesToFile(bookId, noteData);
}

/**
 * Restore notes for a book from disk into the Zustand store.
 *
 * @param bookId - The book ID to restore notes for.
 * @returns The restored notes array, or empty array if no saved notes exist.
 */
export async function restoreNotes(bookId: string): Promise<NoteData[]> {
  const saved = await loadNotesFromFile(bookId);

  if (saved.length === 0) {
    return [];
  }

  // Clear existing notes for this book and load from disk
  const store = useBookStore.getState();
  const { notes } = store;

  // Remove old notes for this book
  const otherNotes = notes.filter((n) => n.bookId !== bookId);

  // Convert and add restored notes
  const restoredNotes = saved.map(toStoreNote);

  // Update the store with all notes
  useBookStore.setState({ notes: [...otherNotes, ...restoredNotes] });

  return saved;
}

/**
 * Create a new note from text selection.
 *
 * @param bookId - The book ID.
 * @param chapterHref - The chapter href where the note is created.
 * @param cfiRange - The CFI range of the selected text.
 * @param text - The selected text being annotated.
 * @param content - The user's note content.
 * @returns The created note.
 */
export async function createNote(
  bookId: string,
  chapterHref: string,
  cfiRange: string,
  text: string,
  content: string
): Promise<Note> {
  const now = Date.now();
  const note: Note = {
    id: generateNoteId(),
    bookId,
    chapterHref,
    cfiRange,
    text,
    content,
    createdAt: now,
  };

  // Add to store
  const store = useBookStore.getState();
  store.addNote(note);

  // Persist to disk
  await persistNotes(bookId);

  return note;
}

/**
 * Delete a note by ID.
 *
 * @param noteId - The note ID to delete.
 * @param bookId - The book ID (for persistence).
 */
export async function deleteNote(noteId: string, bookId: string): Promise<void> {
  const store = useBookStore.getState();
  store.removeNote(noteId);

  // Persist to disk
  await persistNotes(bookId);
}

/**
 * Update a note's content.
 *
 * @param noteId - The note ID to update.
 * @param content - The new content.
 * @param bookId - The book ID (for persistence).
 */
export async function updateNote(
  noteId: string,
  content: string,
  bookId: string
): Promise<void> {
  const store = useBookStore.getState();
  store.updateNote(noteId, content);

  // Persist to disk
  await persistNotes(bookId);
}

/**
 * Get all notes for a specific chapter.
 *
 * @param chapterHref - The chapter href to filter by.
 * @param bookId - Optional book ID to filter by (uses current book if not provided).
 * @returns Array of notes for the chapter.
 */
export function getNotesForChapter(
  chapterHref: string,
  bookId?: string
): Note[] {
  const { notes, currentBook } = useBookStore.getState();
  const targetBookId = bookId || currentBook?.id;

  return notes.filter(
    (n) => n.chapterHref === chapterHref && (!targetBookId || n.bookId === targetBookId)
  );
}

/**
 * Get all notes for the current book.
 *
 * @param bookId - Optional book ID (uses current book if not provided).
 * @returns Array of all notes for the book.
 */
export function getAllNotes(bookId?: string): Note[] {
  const { notes, currentBook } = useBookStore.getState();
  const targetBookId = bookId || currentBook?.id;

  return notes.filter((n) => !targetBookId || n.bookId === targetBookId);
}

/**
 * Delete all notes for a book (e.g., when removing the book).
 *
 * @param bookId - The book ID to delete notes for.
 */
export async function deleteAllNotes(bookId: string): Promise<void> {
  // Remove from store
  useBookStore.setState((state) => ({
    notes: state.notes.filter((n) => n.bookId !== bookId),
  }));

  // Delete persistence file
  await deleteNotesFile(bookId);
}

// --- Highlights ---

/**
 * Persist all highlights for the current book to disk.
 */
async function persistHighlights(bookId: string): Promise<void> {
  const { highlights } = useBookStore.getState();
  const bookHighlights = highlights.filter((h) => h.bookId === bookId);
  const highlightData = bookHighlights.map(toHighlightData);
  await saveHighlightsToFile(bookId, highlightData);
}

/**
 * Restore highlights for a book from disk into the Zustand store.
 *
 * @param bookId - The book ID to restore highlights for.
 * @returns The restored highlights array, or empty array if no saved highlights exist.
 */
export async function restoreHighlights(bookId: string): Promise<HighlightData[]> {
  const saved = await loadHighlightsFromFile(bookId);

  if (saved.length === 0) {
    return [];
  }

  // Clear existing highlights for this book and load from disk
  const { highlights } = useBookStore.getState();

  // Remove old highlights for this book
  const otherHighlights = highlights.filter((h) => h.bookId !== bookId);

  // Convert and add restored highlights
  const restoredHighlights = saved.map(toStoreHighlight);

  // Update the store with all highlights
  useBookStore.setState({ highlights: [...otherHighlights, ...restoredHighlights] });

  return saved;
}

/**
 * Build a CFI range string from a base CFI and a range tuple.
 *
 * Replaces the `:start,end)` suffix in the CFI with the new range values.
 */
function buildCfiRange(baseCfi: string, range: [number, number]): string {
  return baseCfi.replace(/:\d+,\d+\)$/, `:${range[0]},${range[1]})`);
}

/**
 * Create a new highlight from text selection.
 *
 * If the new highlight overlaps existing highlights in the same chapter,
 * all overlapping highlights are merged into one:
 * - Overlapping highlights are deleted from the store
 * - A new highlight is created with the union of all ranges
 * - Texts are concatenated (sorted by range start) with space separator
 * - The new highlight's color is used
 * - A new ID is assigned (old IDs are discarded)
 *
 * Adjacent ranges `[10,50)` + `[50,80)` are NOT merged — only true overlaps.
 * Merge repeats iteratively until no overlaps remain (handles transitive chains).
 *
 * @param bookId - The book ID.
 * @param chapterHref - The chapter href where the highlight is created.
 * @param cfiRange - The CFI range of the selected text.
 * @param text - The selected text being highlighted.
 * @param color - The highlight color.
 * @returns The created (or merged) highlight.
 */
export async function createHighlight(
  bookId: string,
  chapterHref: string,
  cfiRange: string,
  text: string,
  color: string
): Promise<Highlight> {
  const store = useBookStore.getState();

  // Find overlapping highlights in the same chapter/book
  const chapterHighlights = store.highlights.filter(
    (h) => h.bookId === bookId && h.chapterHref === chapterHref
  );

  // Build a temporary highlight to use with findOverlappingHighlights
  const candidate: Highlight = {
    id: "",
    bookId,
    chapterHref,
    cfiRange,
    text,
    color,
    createdAt: 0,
  };

  const overlapping = findOverlappingHighlights(candidate, chapterHighlights);

  if (overlapping.length === 0) {
    // No overlaps — create normally
    const now = Date.now();
    const highlight: Highlight = {
      id: generateHighlightId(),
      bookId,
      chapterHref,
      cfiRange,
      text,
      color,
      createdAt: now,
    };

    store.addHighlight(highlight);
    await persistHighlights(bookId);
    return highlight;
  }

  // Merge overlapping highlights iteratively
  let currentCfi = cfiRange;
  let currentText = text;
  let mergedIds = new Set(overlapping.map((h) => h.id));
  let mergedTexts = new Map<string, { cfi: string; text: string }>();

  // Seed map with overlapping highlights
  for (const h of overlapping) {
    mergedTexts.set(h.id, { cfi: h.cfiRange, text: h.text });
  }
  // Add the new highlight itself
  mergedTexts.set("__new__", { cfi: cfiRange, text });

  // Iterate until no more overlaps
  let prevSize = 0;
  while (mergedIds.size !== prevSize) {
    prevSize = mergedIds.size;

    // Collect all ranges from merged set
    const ranges: Array<{ cfi: string; text: string; key: string }> = [];
    for (const [key, val] of mergedTexts) {
      if (key === "__new__" || mergedIds.has(key)) {
        ranges.push({ cfi: val.cfi, text: val.text, key });
      }
    }

    // Parse ranges and sort by start offset
    const parsed = ranges
      .map((r) => ({
        ...r,
        range: parseCfiRange(r.cfi),
      }))
      .filter((r) => r.range !== null) as Array<{
      cfi: string;
      text: string;
      key: string;
      range: [number, number];
    }>;

    parsed.sort((a, b) => a.range[0] - b.range[0]);

    // Merge all ranges
    const allRanges = parsed.map((p) => p.range);
    const mergedRanges = mergeRanges(allRanges);
    const mergedRange = mergedRanges[0];

    // Build merged CFI and text
    currentCfi = buildCfiRange(cfiRange, mergedRange);
    currentText = parsed.map((p) => p.text).join(" ");

    // Update the "__new__" entry with merged result
    mergedTexts.set("__new__", { cfi: currentCfi, text: currentText });

    // Check if the merged result overlaps any remaining highlights
    const tempHighlight = { cfiRange: currentCfi };
    const newOverlaps = findOverlappingHighlights(
      tempHighlight,
      chapterHighlights.filter((h) => !mergedIds.has(h.id))
    );

    for (const h of newOverlaps) {
      mergedIds.add(h.id);
      mergedTexts.set(h.id, { cfi: h.cfiRange, text: h.text });
    }
  }

  // Delete all overlapping highlights from store
  for (const id of mergedIds) {
    store.removeHighlight(id);
  }

  // Create merged highlight
  const now = Date.now();
  const mergedHighlight: Highlight = {
    id: generateHighlightId(),
    bookId,
    chapterHref,
    cfiRange: currentCfi,
    text: currentText,
    color,
    createdAt: now,
  };

  store.addHighlight(mergedHighlight);
  await persistHighlights(bookId);

  return mergedHighlight;
}

/**
 * Delete a highlight by ID.
 *
 * @param highlightId - The highlight ID to delete.
 * @param bookId - The book ID (for persistence).
 */
export async function deleteHighlight(highlightId: string, bookId: string): Promise<void> {
  const store = useBookStore.getState();
  store.removeHighlight(highlightId);

  // Persist to disk
  await persistHighlights(bookId);
}

/**
 * Update a highlight's color.
 *
 * @param highlightId - The highlight ID to update.
 * @param updates - The updates to apply (currently only color).
 * @param bookId - The book ID (for persistence).
 */
export async function updateHighlight(
  highlightId: string,
  updates: { color: string },
  bookId: string
): Promise<void> {
  const store = useBookStore.getState();
  store.updateHighlight(highlightId, updates);

  // Persist to disk
  await persistHighlights(bookId);
}

/**
 * Get all highlights for a specific chapter.
 *
 * @param chapterHref - The chapter href to filter by.
 * @param bookId - Optional book ID to filter by (uses current book if not provided).
 * @returns Array of highlights for the chapter.
 */
export function getHighlightsForChapter(
  chapterHref: string,
  bookId?: string
): Highlight[] {
  const { highlights, currentBook } = useBookStore.getState();
  const targetBookId = bookId || currentBook?.id;

  return highlights.filter(
    (h) => h.chapterHref === chapterHref && (!targetBookId || h.bookId === targetBookId)
  );
}

/**
 * Get all highlights for the current book.
 *
 * @param bookId - Optional book ID (uses current book if not provided).
 * @returns Array of all highlights for the book.
 */
export function getAllHighlights(bookId?: string): Highlight[] {
  const { highlights, currentBook } = useBookStore.getState();
  const targetBookId = bookId || currentBook?.id;

  return highlights.filter((h) => !targetBookId || h.bookId === targetBookId);
}

/**
 * Delete all highlights for a book (e.g., when removing the book).
 *
 * @param bookId - The book ID to delete highlights for.
 */
export async function deleteAllHighlights(bookId: string): Promise<void> {
  // Remove from store
  useBookStore.setState((state) => ({
    highlights: state.highlights.filter((h) => h.bookId !== bookId),
  }));

  // Delete persistence file
  await deleteHighlightsFile(bookId);
}

// --- ContentRef-aware functions ---

/**
 * Create a new note with a ContentRef for web page annotations.
 *
 * Maps ContentRef fields to the existing bookId/chapterHref fields
 * for backward compatibility while storing the original ContentRef.
 *
 * @param contentRef - The content reference (collectionId + sourceId).
 * @param cfiRange - The CFI range of the selected text.
 * @param text - The selected text being annotated.
 * @param content - The user's note content.
 * @returns The created note.
 */
export async function createNoteWithRef(
  contentRef: ContentRef,
  cfiRange: string,
  text: string,
  content: string
): Promise<Note> {
  const now = Date.now();
  const note: Note = {
    id: generateNoteId(),
    bookId: contentRef.collectionId,
    chapterHref: contentRef.sourceId,
    cfiRange,
    text,
    content,
    createdAt: now,
    contentRef,
  };

  // Add to store
  const store = useBookStore.getState();
  store.addNote(note);

  // Persist to disk
  await persistNotes(contentRef.collectionId);

  return note;
}

/**
 * Create a new highlight with a ContentRef for web page annotations.
 *
 * Maps ContentRef fields to the existing bookId/chapterHref fields
 * for backward compatibility while storing the original ContentRef.
 * Does NOT merge overlapping highlights (unlike createHighlight).
 *
 * @param contentRef - The content reference (collectionId + sourceId).
 * @param cfiRange - The CFI range of the selected text.
 * @param text - The selected text being highlighted.
 * @param color - The highlight color.
 * @returns The created highlight.
 */
export async function createHighlightWithRef(
  contentRef: ContentRef,
  cfiRange: string,
  text: string,
  color: string
): Promise<Highlight> {
  const now = Date.now();
  const highlight: Highlight = {
    id: generateHighlightId(),
    bookId: contentRef.collectionId,
    chapterHref: contentRef.sourceId,
    cfiRange,
    text,
    color,
    createdAt: now,
    contentRef,
  };

  const store = useBookStore.getState();
  store.addHighlight(highlight);
  await persistHighlights(contentRef.collectionId);

  return highlight;
}

/**
 * Get all notes for a specific content source.
 *
 * Matches notes by contentRef.collectionId and contentRef.sourceId.
 * Falls back to matching by bookId and chapterHref for notes without contentRef.
 *
 * @param contentRef - The content reference to filter by.
 * @returns Array of notes for the content source.
 */
export function getNotesForSource(contentRef: ContentRef): Note[] {
  const { notes } = useBookStore.getState();

  return notes.filter((n) => {
    if (n.contentRef) {
      return (
        n.contentRef.collectionId === contentRef.collectionId &&
        n.contentRef.sourceId === contentRef.sourceId
      );
    }
    // Backward compat: match by bookId/chapterHref
    return n.bookId === contentRef.collectionId && n.chapterHref === contentRef.sourceId;
  });
}

/**
 * Get all highlights for a specific content source.
 *
 * Matches highlights by contentRef.collectionId and contentRef.sourceId.
 * Falls back to matching by bookId and chapterHref for highlights without contentRef.
 *
 * @param contentRef - The content reference to filter by.
 * @returns Array of highlights for the content source.
 */
export function getHighlightsForSource(contentRef: ContentRef): Highlight[] {
  const { highlights } = useBookStore.getState();

  return highlights.filter((h) => {
    if (h.contentRef) {
      return (
        h.contentRef.collectionId === contentRef.collectionId &&
        h.contentRef.sourceId === contentRef.sourceId
      );
    }
    // Backward compat: match by bookId/chapterHref
    return h.bookId === contentRef.collectionId && h.chapterHref === contentRef.sourceId;
  });
}

// Re-export public API
export {
  loadNotesFromFile,
  saveNotesToFile,
  deleteNotesFile,
  loadHighlightsFromFile,
  saveHighlightsToFile,
  deleteHighlightsFile,
} from "./persistence";
export type { NoteData, NoteConfig, HighlightData } from "./types";
export { DEFAULT_NOTE_CONFIG } from "./types";
