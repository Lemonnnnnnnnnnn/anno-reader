import { create } from "zustand";

// --- Interfaces ---

export interface BookMetadata {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  filePath: string;
  lastOpened: number;
}

export interface ReadingProgress {
  bookId: string;
  chapterHref: string;
  chapterIndex: number;
  percentage: number;
  scrollOffset: number;
}

export interface Note {
  id: string;
  bookId: string;
  chapterHref: string;
  cfiRange: string;
  text: string;
  content: string;
  createdAt: number;
}

export interface Highlight {
  id: string;
  bookId: string;
  chapterHref: string;
  cfiRange: string;
  text: string;
  color: string;
  createdAt: number;
}

export interface UIState {
  currentChapter: string | null;
  currentChapterIndex: number;
  scrollPosition: number;
  pendingScrollCfi: string | null;
  theme: "light" | "dark";
}

// --- Store ---

export interface BookStore {
  // State
  currentBook: BookMetadata | null;
  readingProgress: ReadingProgress | null;
  notes: Note[];
  highlights: Highlight[];
  ui: UIState;

  // Book actions
  setBook: (book: BookMetadata | null) => void;
  updateBookMetadata: (updates: Partial<BookMetadata>) => void;

  // Progress actions
  setReadingProgress: (progress: ReadingProgress) => void;

  // Note actions
  addNote: (note: Note) => void;
  removeNote: (noteId: string) => void;
  updateNote: (noteId: string, content: string) => void;

  // Highlight actions
  addHighlight: (highlight: Highlight) => void;
  removeHighlight: (highlightId: string) => void;
  updateHighlight: (highlightId: string, updates: Partial<Pick<Highlight, "color">>) => void;

  // UI actions
  setCurrentChapter: (chapter: string, index: number) => void;
  setScrollPosition: (position: number) => void;
  setPendingScrollCfi: (cfi: string | null) => void;
  setTheme: (theme: "light" | "dark") => void;
}

const DEFAULT_UI_STATE: UIState = {
  currentChapter: null,
  currentChapterIndex: 0,
  scrollPosition: 0,
  pendingScrollCfi: null,
  theme: "light",
};

export const useBookStore = create<BookStore>((set) => ({
  // Initial state
  currentBook: null,
  readingProgress: null,
  notes: [],
  highlights: [],
  ui: DEFAULT_UI_STATE,

  // Book actions
  setBook: (book) => set({ currentBook: book }),

  updateBookMetadata: (updates) =>
    set((state) => ({
      currentBook: state.currentBook
        ? { ...state.currentBook, ...updates }
        : null,
    })),

  // Progress actions
  setReadingProgress: (progress) => set({ readingProgress: progress }),

  // Note actions
  addNote: (note) =>
    set((state) => ({ notes: [...state.notes, note] })),

  removeNote: (noteId) =>
    set((state) => ({ notes: state.notes.filter((n) => n.id !== noteId) })),

  updateNote: (noteId, content) =>
    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === noteId ? { ...n, content } : n
      ),
    })),

  // Highlight actions
  addHighlight: (highlight) =>
    set((state) => ({ highlights: [...state.highlights, highlight] })),

  removeHighlight: (highlightId) =>
    set((state) => ({
      highlights: state.highlights.filter((h) => h.id !== highlightId),
    })),

  updateHighlight: (highlightId, updates) =>
    set((state) => ({
      highlights: state.highlights.map((h) =>
        h.id === highlightId ? { ...h, ...updates } : h
      ),
    })),

  // UI actions
  setCurrentChapter: (chapter, index) =>
    set((state) => ({
      ui: { ...state.ui, currentChapter: chapter, currentChapterIndex: index },
    })),

  setScrollPosition: (position) =>
    set((state) => ({
      ui: { ...state.ui, scrollPosition: position },
    })),

  setPendingScrollCfi: (cfi) =>
    set((state) => ({
      ui: { ...state.ui, pendingScrollCfi: cfi },
    })),

  setTheme: (theme) =>
    set((state) => ({ ui: { ...state.ui, theme } })),
}));
