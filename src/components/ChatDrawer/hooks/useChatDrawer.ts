/**
 * useChatDrawer hook for ChatDrawer component.
 *
 * Manages the full lifecycle of a chat drawer session:
 * - View state (list vs conversation)
 * - Conversation persistence via useChatStore
 * - Streaming responses via useChatStreaming
 * - RAG context for book-aware answers
 * - Debounced send with retry support
 * - Auto-abort on drawer close
 * - Message sync back to store on completion
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useChatStore } from "@/stores/useChatStore";
import { useBookStore } from "@/stores/useBookStore";
import { useChatStreaming } from "@/lib/chat/streaming";
import { useRAG } from "@/lib/rag";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum interval between consecutive sends (ms). */
const DEBOUNCE_MIN_MS = 1000;

// ---------------------------------------------------------------------------
// Hook Parameters
// ---------------------------------------------------------------------------

interface UseChatDrawerParams {
  /** Whether the drawer is currently open */
  isOpen: boolean;
  /** Book ID for filtering conversations. Falls back to useBookStore if omitted. */
  bookId?: string;
  /** Initial message to pre-fill (e.g., from "Ask AI" selection) */
  initialMessage?: string;
}

// ---------------------------------------------------------------------------
// Hook Return Type
// ---------------------------------------------------------------------------

interface UseChatDrawerReturn {
  /** Current view: "list" or "conversation" */
  view: "list" | "conversation";
  /** Current book ID */
  bookId: string;
  /** Conversation messages */
  messages: import("@/lib/chat/types").ChatMessage[];
  /** Text being streamed in real-time */
  streamingText: string;
  /** Current streaming status */
  status: import("@/lib/chat/streaming").ChatStreamingStatus;
  /** Error message, if any */
  error: string | null;
  /** Classified error code */
  errorCode: import("@/lib/ai/service").AIServiceErrorCode | null;
  /** Send a user message */
  onSend: (content: string) => void;
  /** Abort the current streaming response */
  onStop: () => void;
  /** Retry the last failed request */
  onRetry: () => void;
  /** Navigate back to the session list */
  onBackToList: () => void;
  /** Create a new conversation */
  onNewChat: () => void;
  /** Whether the book is currently being indexed */
  isIndexing: boolean;
  /** Error from RAG indexing, if any */
  ragError: string | null;
  /** Retry RAG indexing after failure */
  onRetryIndexing: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useChatDrawer — orchestrates chat drawer state, streaming, persistence,
 * and RAG integration.
 */
export function useChatDrawer({
  isOpen,
  bookId: bookIdProp,
  initialMessage,
}: UseChatDrawerParams): UseChatDrawerReturn {
  // Book ID — use prop or fall back to current book from store
  const currentBook = useBookStore((s) => s.currentBook);
  const bookId = bookIdProp ?? currentBook?.id ?? "";

  // Store integration — conversation persistence
  const {
    messages: storeMessages,
    addMessage,
    loadConversations,
    currentConversationId,
    setCurrentConversation,
    createConversation,
  } = useChatStore();

  // Streaming integration — active chat session
  const {
    messages,
    streamingText,
    status,
    error,
    errorCode,
    sendChatMessage,
    stopStreaming,
    reset,
  } = useChatStreaming(storeMessages);

  // RAG integration — book context for chat
  const rag = useRAG();

  // View state: defaults to conversation if a conversation is already active
  const [view, setView] = useState<"list" | "conversation">(
    currentConversationId ? "conversation" : "list",
  );

  // Refs for debounce and retry
  const lastSendTimeRef = useRef(0);
  const lastContentRef = useRef<string | null>(null);
  // Track when user navigates back to list to avoid auto-switching back
  const navigatingBackRef = useRef(false);

  // Load persisted conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Auto-create new session when initialMessage is provided (e.g., from "Ask AI" selection)
  useEffect(() => {
    if (isOpen && initialMessage) {
      // Create a new conversation with truncated selection text as title
      const title = initialMessage.length > 50
        ? initialMessage.slice(0, 50) + "..."
        : initialMessage;
      const newId = crypto.randomUUID();
      createConversation(newId, bookId);
      // Rename with the selection text as title
      useChatStore.getState().renameConversation(newId, title);
      setView("conversation");
    }
  }, [isOpen, initialMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Abort on drawer close
  useEffect(() => {
    if (!isOpen) {
      stopStreaming();
    }
  }, [isOpen, stopStreaming]);

  // Sync completed assistant messages to the store.
  // When status transitions from streaming → idle and we have messages,
  // persist the latest user + assistant pair.
  useEffect(() => {
    if (status !== "idle" || messages.length === 0) return;

    // Ensure a conversation exists
    if (!currentConversationId) {
      createConversation(crypto.randomUUID());
    }

    // Find messages not yet in the store by comparing lengths
    const unsyncedCount = messages.length - storeMessages.length;
    if (unsyncedCount > 0) {
      const unsynced = messages.slice(-unsyncedCount);
      for (const msg of unsynced) {
        addMessage(msg);
      }
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect when SessionList selects a conversation (setCurrentConversation)
  // and switch to conversation view + reset streaming state.
  useEffect(() => {
    if (currentConversationId && view === "list" && !navigatingBackRef.current) {
      // A conversation was selected from the list — load its messages
      const conv = useChatStore.getState().conversations.find((c) => c.id === currentConversationId);
      reset(conv?.messages ?? []);
      setView("conversation");
    }
    // Reset the flag after processing
    navigatingBackRef.current = false;
  }, [currentConversationId, view, reset]);

  // Create a new conversation and switch to conversation view
  const handleNewChat = useCallback(() => {
    setView("conversation");
  }, []);

  // Navigate back to session list
  const handleBackToList = useCallback(() => {
    navigatingBackRef.current = true;
    stopStreaming();
    setCurrentConversation(null);
    reset([]);
    setView("list");
  }, [stopStreaming, setCurrentConversation, reset]);

  const sendContent = useCallback(
    async (content: string, options?: { skipDebounce?: boolean }) => {
      const now = Date.now();
      if (!options?.skipDebounce && now - lastSendTimeRef.current < DEBOUNCE_MIN_MS) {
        return;
      }
      lastSendTimeRef.current = now;

      // Track content for retry
      lastContentRef.current = content;

      // Ensure conversation exists before sending
      if (!currentConversationId) {
        createConversation(crypto.randomUUID(), bookId);
      }

      // Get RAG context for the query
      const ragResult = await rag.askQuestion(content);

      // Send via streaming with RAG system message
      await sendChatMessage(content, ragResult?.systemMessage);
    },
    [currentConversationId, createConversation, sendChatMessage, bookId, rag],
  );

  const handleSend = useCallback(
    (content: string) => {
      void sendContent(content);
    },
    [sendContent],
  );

  const handleRetry = useCallback(() => {
    if (lastContentRef.current) {
      void sendContent(lastContentRef.current, { skipDebounce: true });
    }
  }, [sendContent]);

  // Retry RAG indexing — re-triggers the hook's internal state by sending last query
  const handleRetryIndexing = useCallback(() => {
    // Clear the RAG error by asking a simple question which will re-trigger indexing
    rag.askQuestion("retry");
  }, [rag]);

  return {
    view,
    bookId,
    messages,
    streamingText,
    status,
    error,
    errorCode,
    onSend: handleSend,
    onStop: stopStreaming,
    onRetry: handleRetry,
    onBackToList: handleBackToList,
    onNewChat: handleNewChat,
    isIndexing: rag.isIndexing,
    ragError: rag.error,
    onRetryIndexing: handleRetryIndexing,
  };
}
