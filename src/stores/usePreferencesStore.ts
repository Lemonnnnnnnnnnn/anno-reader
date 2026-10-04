import { create } from "zustand";
import type { NoteDetailVariant } from "@/components/AnnotationDetailPanel";

/** Container style for switchable panels (note detail, AI chat). */
export type PanelLayout = "drawer" | "modal";

/**
 * User-facing display preferences (the "个性化" settings page).
 *
 * Persisted to localStorage — these are pure UI choices, unlike the
 * Tauri-managed config file which stores data directories and proxies.
 * Reads are guarded so the store can be imported in non-browser
 * environments (tests) without throwing.
 */

const NOTE_DETAIL_LAYOUT_KEY = "noteDetailLayout";
const CHAT_LAYOUT_KEY = "chatLayout";

function readStoredLayout(key: string, fallback: PanelLayout): PanelLayout {
  try {
    const value = localStorage.getItem(key);
    return value === "drawer" || value === "modal" ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredLayout(key: string, layout: PanelLayout): void {
  try {
    localStorage.setItem(key, layout);
  } catch {
    // Non-fatal: the preference just won't survive a restart.
  }
}

interface PreferencesStore {
  hideReadingScrollbar: boolean;
  setHideReadingScrollbar: (hidden: boolean) => void;
  /** How the note detail panel is displayed (default: drawer). */
  noteDetailLayout: NoteDetailVariant;
  setNoteDetailLayout: (layout: PanelLayout) => void;
  /** How the AI chat panel is displayed (default: modal). */
  chatLayout: PanelLayout;
  setChatLayout: (layout: PanelLayout) => void;
}

export const usePreferencesStore = create<PreferencesStore>((set) => ({
  hideReadingScrollbar: (() => {
    try { return localStorage.getItem("hideReadingScrollbar") !== "false"; }
    catch { return true; }
  })(),
  setHideReadingScrollbar: (hidden) => {
    try { localStorage.setItem("hideReadingScrollbar", String(hidden)); } catch { /* UI preference remains usable */ }
    set({ hideReadingScrollbar: hidden });
  },
  noteDetailLayout: readStoredLayout(NOTE_DETAIL_LAYOUT_KEY, "drawer"),

  setNoteDetailLayout: (layout) => {
    writeStoredLayout(NOTE_DETAIL_LAYOUT_KEY, layout);
    set({ noteDetailLayout: layout });
  },

  chatLayout: readStoredLayout(CHAT_LAYOUT_KEY, "modal"),

  setChatLayout: (layout) => {
    writeStoredLayout(CHAT_LAYOUT_KEY, layout);
    set({ chatLayout: layout });
  },
}));
