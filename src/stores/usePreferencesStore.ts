import { create } from "zustand";
import type { NoteDetailVariant } from "@/components/AnnotationDetailPanel";

/**
 * User-facing display preferences (the "个性化" settings page).
 *
 * Persisted to localStorage — these are pure UI choices, unlike the
 * Tauri-managed config file which stores data directories and proxies.
 * Reads are guarded so the store can be imported in non-browser
 * environments (tests) without throwing.
 */

const NOTE_DETAIL_LAYOUT_KEY = "noteDetailLayout";

function readStoredLayout(): NoteDetailVariant {
  try {
    const value = localStorage.getItem(NOTE_DETAIL_LAYOUT_KEY);
    return value === "modal" ? "modal" : "drawer";
  } catch {
    return "drawer";
  }
}

function writeStoredLayout(layout: NoteDetailVariant): void {
  try {
    localStorage.setItem(NOTE_DETAIL_LAYOUT_KEY, layout);
  } catch {
    // Non-fatal: the preference just won't survive a restart.
  }
}

interface PreferencesStore {
  /** How the note detail panel is displayed (default: drawer). */
  noteDetailLayout: NoteDetailVariant;
  setNoteDetailLayout: (layout: NoteDetailVariant) => void;
}

export const usePreferencesStore = create<PreferencesStore>((set) => ({
  noteDetailLayout: readStoredLayout(),

  setNoteDetailLayout: (layout) => {
    writeStoredLayout(layout);
    set({ noteDetailLayout: layout });
  },
}));
