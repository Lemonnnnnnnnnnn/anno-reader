import { create } from "zustand";
import { fetchWebPage } from "@/lib/web/fetcher";
import { cleanHtml } from "@/lib/web/cleaner";
import type { WebPage } from "@/lib/web/types";

// --- Types ---

export interface WebPageState {
  /** Currently displayed page */
  currentPage: WebPage | null;
  /** Navigation history (most recent last) */
  history: WebPage[];
  /** Index into history for current page */
  historyIndex: number;
  /** Whether a page is currently loading */
  isLoading: boolean;
  /** Error message if page load failed */
  error: string | null;
}

export interface WebStore extends WebPageState {
  // Actions
  loadWebPage: (url: string) => Promise<void>;
  goBack: () => void;
  goForward: () => void;
  clearError: () => void;
}

// --- Store ---

export const useWebStore = create<WebStore>((set, get) => ({
  // Initial state
  currentPage: null,
  history: [],
  historyIndex: -1,
  isLoading: false,
  error: null,

  // Actions
  loadWebPage: async (url: string) => {
    set({ isLoading: true, error: null });

    try {
      const fetched = await fetchWebPage(url);
      const cleaned = cleanHtml(fetched.html);

      const page: WebPage = {
        ...fetched,
        html: cleaned.html,
        plainText: cleaned.plainText,
      };

      const { history, historyIndex } = get();
      // Discard forward history when navigating to a new page
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(page);

      set({
        currentPage: page,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load page";
      set({ error: message, isLoading: false });
    }
  },

  goBack: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    set({ currentPage: history[newIndex], historyIndex: newIndex, error: null });
  },

  goForward: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    set({ currentPage: history[newIndex], historyIndex: newIndex, error: null });
  },

  clearError: () => set({ error: null }),
}));
