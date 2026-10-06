/**
 * useChatDrawer hook for ChatDrawer component.
 *
 * Manages the full lifecycle of a chat drawer session:
 * - View state (list vs conversation)
 * - Conversation persistence via useChatStore
 * - Streaming responses via useChatStreaming
 * - Chapter context binding (snapshot per conversation, injected as the
 *   request-time system prompt when enabled)
 * - Debounced send with retry support
 * - Auto-abort on drawer close
 * - Message sync back to store on completion
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useChatStore } from "@/stores/useChatStore";
import { useBookStore } from "@/stores/useBookStore";
import { useChatStreaming } from "@/lib/chat/streaming";
import {
  buildChatSystemPrompt,
  type ChapterContext,
  type ChatRequestDebugInfo,
} from "@/lib/chat/context";
import type { ContextChapter } from "@/lib/chat/types";

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
  /** href of the chapter currently open in the reader (null/undefined when unavailable) */
  currentChapterHref?: string | null;
  /** Resolve a chapter (href/title/full text) by href, e.g. for the bound context chapter */
  resolveChapterContext?: (href: string) => ChapterContext | null;
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
  /** Chapter snapshot bound to the active conversation view (null = no context) */
  contextChapter: ContextChapter | null;
  /** Bind the current reader chapter to the conversation, or unbind */
  onToggleChapterContext: (checked: boolean) => void;
  /** Snapshot of the request that the next send would produce (debug panel) */
  buildDebugInfo: () => ChatRequestDebugInfo;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useChatDrawer — orchestrates chat drawer state, streaming, persistence,
 * and chapter context binding.
 */
export function useChatDrawer({
  isOpen,
  bookId: bookIdProp,
  initialMessage,
  currentChapterHref,
  resolveChapterContext,
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

  // View state: defaults to conversation if a conversation is already active
  const [view, setView] = useState<"list" | "conversation">(
    currentConversationId ? "conversation" : "list",
  );

  // Chapter context snapshot bound to the active conversation view.
  // Null = unchecked (no chapter text is sent).
  const [contextChapter, setContextChapter] = useState<ContextChapter | null>(
    null,
  );

  // Refs for debounce and retry
  const lastSendTimeRef = useRef(0);
  const lastContentRef = useRef<string | null>(null);
  // Track when user navigates back to list to avoid auto-switching back
  const navigatingBackRef = useRef(false);

  /** Snapshot the chapter currently open in the reader, or null. */
  const bindCurrentChapter = useCallback((): ContextChapter | null => {
    if (!currentChapterHref || !resolveChapterContext) return null;
    const ctx = resolveChapterContext(currentChapterHref);
    return ctx ? { href: ctx.href, title: ctx.title } : null;
  }, [currentChapterHref, resolveChapterContext]);

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
      const chapter = bindCurrentChapter();
      setContextChapter(chapter);
      createConversation(newId, bookId, chapter);
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
  // and switch to conversation view + reset streaming state. The bound
  // chapter context always follows the selected conversation — opening an
  // old conversation never inherits the chapter currently on screen.
  useEffect(() => {
    if (currentConversationId && view === "list" && !navigatingBackRef.current) {
      // A conversation was selected from the list — load its messages
      const conv = useChatStore.getState().conversations.find((c) => c.id === currentConversationId);
      reset(conv?.messages ?? []);
      setContextChapter(conv?.contextChapter ?? null);
      setView("conversation");
    }
    // Reset the flag after processing
    navigatingBackRef.current = false;
  }, [currentConversationId, view, reset]);

  // Create a new conversation and switch to conversation view.
  // A new chat defaults to the chapter currently open in the reader.
  const handleNewChat = useCallback(() => {
    setContextChapter(bindCurrentChapter());
    setView("conversation");
  }, [bindCurrentChapter]);

  // Navigate back to session list
  const handleBackToList = useCallback(() => {
    navigatingBackRef.current = true;
    stopStreaming();
    setCurrentConversation(null);
    reset([]);
    setView("list");
  }, [stopStreaming, setCurrentConversation, reset]);

  // Bind the current reader chapter to the conversation, or unbind.
  // Checking while unchecked always (re)binds to the chapter currently on
  // screen; unchecking removes the context from future requests entirely.
  const handleToggleChapterContext = useCallback(
    (checked: boolean) => {
      const next = checked ? bindCurrentChapter() : null;
      setContextChapter(next);
      const convId = useChatStore.getState().currentConversationId;
      if (convId) {
        useChatStore.getState().setConversationContext(convId, next);
      }
    },
    [bindCurrentChapter],
  );

  const sendContent = useCallback(
    async (content: string, options?: { skipDebounce?: boolean }) => {
      const now = Date.now();
      if (!options?.skipDebounce && now - lastSendTimeRef.current < DEBOUNCE_MIN_MS) {
        return;
      }
      lastSendTimeRef.current = now;

      // Track content for retry
      lastContentRef.current = content;

      // Track if we're creating a new conversation (for auto-naming)
      let isNewConversation = false;

      // Ensure conversation exists before sending
      if (!currentConversationId) {
        createConversation(crypto.randomUUID(), bookId, contextChapter);
        isNewConversation = true;
      }

      // Auto-rename new conversation with truncated message content
      if (isNewConversation) {
        const title = content.length > 50
          ? content.slice(0, 50) + "..."
          : content;
        const newId = useChatStore.getState().currentConversationId;
        if (newId) {
          useChatStore.getState().renameConversation(newId, title);
        }
      }

      // Build the system prompt: persona + book metadata, plus the bound
      // chapter's full text when the context checkbox is on. The bound
      // href is resolved at send time so re-opening the book keeps working.
      const chapter =
        contextChapter && resolveChapterContext
          ? resolveChapterContext(contextChapter.href)
          : null;
      const system = buildChatSystemPrompt({
        bookTitle: currentBook?.title,
        bookAuthor: currentBook?.author,
        chapter,
      });

      // Send via streaming with the assembled system message
      await sendChatMessage(content, system);
    },
    [
      currentConversationId,
      createConversation,
      sendChatMessage,
      bookId,
      contextChapter,
      resolveChapterContext,
      currentBook,
    ],
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

  // Snapshot of the request the next send would produce (debug panel).
  const buildDebugInfo = useCallback((): ChatRequestDebugInfo => {
    const chapter =
      contextChapter && resolveChapterContext
        ? resolveChapterContext(contextChapter.href)
        : null;
    const system = buildChatSystemPrompt({
      bookTitle: currentBook?.title,
      bookAuthor: currentBook?.author,
      chapter,
    });
    return {
      system,
      messages,
      chapterBound: contextChapter,
      chapterResolved: Boolean(chapter),
      chapterTextLength: chapter?.text.length ?? 0,
    };
  }, [contextChapter, resolveChapterContext, currentBook, messages]);

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
    contextChapter,
    onToggleChapterContext: handleToggleChapterContext,
    buildDebugInfo,
  };
}
