import { create } from "zustand";
import type { ChatConversation, ChatMessage } from "@/lib/chat/types";
import {
  loadConversations as loadFromDisk,
  saveConversations,
} from "@/lib/chat/persistence";

// ---------------------------------------------------------------------------
// Store Interface
// ---------------------------------------------------------------------------

export interface ChatStore {
  /** All chat conversations */
  conversations: ChatConversation[];
  /** ID of the currently active conversation, null if none selected */
  currentConversationId: string | null;
  /** Messages of the current conversation (convenience field) */
  messages: ChatMessage[];
  /** Whether the initial load from disk has completed */
  isLoaded: boolean;

  // Actions
  addMessage: (message: ChatMessage) => void;
  createConversation: (id: string, bookId?: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  setCurrentConversation: (id: string | null) => void;

  // Persistence
  persistConversations: () => Promise<void>;
  loadConversations: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Persist Helper (fire-and-forget)
// ---------------------------------------------------------------------------

function persistAfterSet(get: () => ChatStore) {
  get().persistConversations().catch((err) => {
    console.error("Failed to persist chat conversations:", err);
  });
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isLoaded: false,

  addMessage: (message) => {
    set((state) => {
      const { currentConversationId, conversations } = state;
      if (!currentConversationId) return state;

      const updatedConversations = conversations.map((conv) => {
        if (conv.id !== currentConversationId) return conv;
        return {
          ...conv,
          messages: [...conv.messages, message],
          updatedAt: Date.now(),
        };
      });

      const currentConv = updatedConversations.find(
        (c) => c.id === currentConversationId,
      );

      return {
        conversations: updatedConversations,
        messages: currentConv?.messages ?? [],
      };
    });
    persistAfterSet(get);
  },

  createConversation: (id, bookId = "") => {
    const now = Date.now();
    const newConversation: ChatConversation = {
      id,
      title: "New Conversation",
      bookId,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      conversations: [...state.conversations, newConversation],
      currentConversationId: id,
      messages: [],
    }));
    persistAfterSet(get);
  },

  deleteConversation: (id) => {
    set((state) => {
      const filtered = state.conversations.filter((c) => c.id !== id);

      // If the deleted conversation was active, select the first remaining or null
      let nextId = state.currentConversationId;
      let nextMessages = state.messages;
      if (state.currentConversationId === id) {
        const next = filtered[0] ?? null;
        nextId = next?.id ?? null;
        nextMessages = next?.messages ?? [];
      }

      return {
        conversations: filtered,
        currentConversationId: nextId,
        messages: nextMessages,
      };
    });
    persistAfterSet(get);
  },

  renameConversation: (id, title) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === id ? { ...conv, title, updatedAt: Date.now() } : conv,
      ),
    }));
    persistAfterSet(get);
  },

  setCurrentConversation: (id) => {
    set((state) => {
      const conv = state.conversations.find((c) => c.id === id);
      return {
        currentConversationId: id,
        messages: conv?.messages ?? [],
      };
    });
  },

  persistConversations: async () => {
    const { conversations } = get();
    await saveConversations(conversations);
  },

  loadConversations: async () => {
    try {
      const loaded = await loadFromDisk();
      // Migrate existing conversations: add default title/bookId if missing
      const conversations = loaded.map((conv) => ({
        ...conv,
        title: conv.title ?? "New Conversation",
        bookId: conv.bookId ?? "",
      }));
      set({ conversations, isLoaded: true });
    } catch (err) {
      console.error("Failed to load chat conversations:", err);
      set({ isLoaded: true });
    }
  },
}));
