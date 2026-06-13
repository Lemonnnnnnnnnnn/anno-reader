import type { Note, Highlight } from "@/stores/useBookStore";
import type { EpubChapterInfo } from "@/lib/epub/types";

/** Active tab key in the drawer */
export type TabKey = "notes" | "highlights";

/** Props for the AnnotationDrawer component */
export interface AnnotationDrawerProps {
  /** Whether the drawer is visible */
  open: boolean;
  /** Callback when the drawer should close */
  onClose: () => void;
  /** Callback to navigate to a chapter (href, index, cfiRange?) */
  onNavigate: (href: string, index: number, cfiRange?: string) => void;
  /** All chapters for href-to-index resolution */
  chapters: EpubChapterInfo[];
}

/** Props for the NoteItem sub-component */
export interface NoteItemProps {
  note: Note;
  onNavigate: (href: string, index: number, cfiRange?: string) => void;
  onClose: () => void;
  chapters: EpubChapterInfo[];
}

/** Props for the HighlightItem sub-component */
export interface HighlightItemProps {
  highlight: Highlight;
  onNavigate: (href: string, index: number, cfiRange?: string) => void;
  onClose: () => void;
  chapters: EpubChapterInfo[];
}
