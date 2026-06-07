/**
 * ChatDrawer component.
 *
 * Right-side drawer for AI chat conversations. Composes MessageList and
 * ChatInput inside a Drawer B container. Integrates useChatStore for
 * conversation persistence and useChatStreaming for real-time responses.
 *
 * Aborts any in-flight streaming request when the drawer closes.
 *
 * @example
 * ```tsx
 * <ChatDrawer isOpen={open} onClose={() => setOpen(false)} />
 * ```
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Loader2, Bot, BookOpen, Lightbulb, HelpCircle, Settings, RefreshCw, Clock } from "lucide-react";
import { Drawer, Button, ErrorBanner } from "@/components/primitives";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { SessionList } from "./SessionList";
import { useChatStore } from "@/stores/useChatStore";
import { useBookStore } from "@/stores/useBookStore";
import { useChatStreaming } from "@/lib/chat/streaming";
import { useRAG } from "@/lib/rag";
import type { ChatMessage } from "@/lib/chat/types";
import type { ChatStreamingStatus } from "@/lib/chat/streaming";
import type { AIServiceErrorCode } from "@/lib/ai/service";

// ---------------------------------------------------------------------------
// View Props
// ---------------------------------------------------------------------------

interface ChatDrawerViewProps {
  /** Whether the drawer is visible */
  isOpen: boolean;
  /** Callback when the drawer should close */
  onClose: () => void;
  /** Current view: "list" (session list) or "conversation" (chat). Defaults to "conversation". */
  view?: "list" | "conversation";
  /** Current book ID for filtering conversations */
  bookId?: string;
  /** Current conversation messages */
  messages: ChatMessage[];
  /** Text being streamed in real-time */
  streamingText: string;
  /** Current streaming status */
  status: ChatStreamingStatus;
  /** Error message, if any */
  error: string | null;
  /** Classified error code for type-aware error UI */
  errorCode: AIServiceErrorCode | null;
  /** Send a user message */
  onSend: (content: string) => void;
  /** Abort the current streaming response */
  onStop: () => void;
  /** Retry the last failed request */
  onRetry: () => void;
  /** Navigate back to the session list */
  onBackToList?: () => void;
  /** Create a new conversation (called from list view "New Chat" button) */
  onNewChat: () => void;
  /** Initial message to pre-fill the chat input (e.g., from "Ask AI" selection) */
  initialMessage?: string;
  /** Whether the book is currently being indexed by RAG */
  isIndexing?: boolean;
  /** Error from RAG indexing, if any */
  ragError?: string | null;
  /** Retry RAG indexing after failure */
  onRetryIndexing?: () => void;
}

// ---------------------------------------------------------------------------
// View Component
// ---------------------------------------------------------------------------

/**
 * Typing indicator — three animated dots for streaming state.
 */
function TypingIndicator() {
  return (
    <div className="flex items-start gap-2 py-2 px-3">
      <div className="shrink-0 w-6 h-6 rounded-full bg-surface-alt dark:bg-surface-alt-dark flex items-center justify-center">
        <Bot className="h-3.5 w-3.5 text-text-secondary dark:text-text-secondary-dark" />
      </div>
      <div className="flex items-center gap-1 px-3 py-2 bg-surface-alt dark:bg-surface-alt-dark rounded-lg rounded-bl-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-text-muted dark:bg-text-muted-dark animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-text-muted dark:bg-text-muted-dark animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-text-muted dark:bg-text-muted-dark animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

/**
 * Welcome empty state — shown when there are no messages.
 */
function WelcomeEmptyState({ onSend }: { onSend: (content: string) => void }) {
  const tips = [
    { icon: BookOpen, text: "Ask about this book", prompt: "Please introduce the main themes and content of this book." },
    { icon: Lightbulb, text: "Request a summary", prompt: "Please provide a comprehensive summary of this book." },
    { icon: HelpCircle, text: "Explain a passage", prompt: "Please explain the current chapter's main content and key points." },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
      {/* AI avatar */}
      <div className="w-12 h-12 rounded-full bg-accent/10 dark:bg-accent-dark/10 flex items-center justify-center mb-4">
        <Bot className="h-6 w-6 text-accent dark:text-accent-dark" />
      </div>

      {/* Welcome message */}
      <h3 className="text-base font-medium text-text dark:text-text-dark font-sans mb-1">
        Welcome to AI Chat
      </h3>
      <p className="text-sm text-text-secondary dark:text-text-secondary-dark font-sans text-center mb-6">
        Ask me anything about this book
      </p>

      {/* Usage tips */}
      <div className="flex flex-col gap-2 w-full max-w-[240px]">
        {tips.map(({ icon: Icon, text, prompt }) => (
          <button
            key={text}
            type="button"
            onClick={() => onSend(prompt)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-alt dark:bg-surface-alt-dark cursor-pointer transition-colors hover:bg-border/40 dark:hover:bg-border-dark/40 active:bg-border/60 dark:active:bg-border-dark/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent dark:focus-visible:outline-accent-dark"
          >
            <Icon className="h-4 w-4 text-text-secondary dark:text-text-secondary-dark shrink-0" />
            <span className="text-sm text-text-secondary dark:text-text-secondary-dark font-sans">
              {text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Indexing empty state — shown while book is being indexed and no messages yet.
 */
function IndexingEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
      <div className="w-12 h-12 rounded-full bg-accent/10 dark:bg-accent-dark/10 flex items-center justify-center mb-4">
        <Loader2 className="h-6 w-6 text-accent dark:text-accent-dark animate-spin" />
      </div>
      <h3 className="text-base font-medium text-text dark:text-text-dark font-sans mb-1">
        Indexing book…
      </h3>
      <p className="text-sm text-text-secondary dark:text-text-secondary-dark font-sans text-center">
        Analyzing chapters for better context
      </p>
    </div>
  );
}

/**
 * Indexing indicator — subtle inline bar shown while indexing with messages present.
 */
function IndexingIndicator() {
  return (
    <div className="flex items-center gap-2 py-1.5 px-3 text-text-muted dark:text-text-muted-dark">
      <Loader2 className="animate-spin h-3.5 w-3.5" />
      <span className="text-xs font-sans">Indexing book for better answers…</span>
    </div>
  );
}

/**
 * DEBOUNCE_MIN_MS — minimum interval between consecutive sends.
 */
const DEBOUNCE_MIN_MS = 1000;

/**
 * Error banner with type-aware UI: config guidance, retry button, or wait hint.
 */
function ChatErrorBanner({
  error,
  errorCode,
  onRetry,
}: {
  error: string;
  errorCode: AIServiceErrorCode | null;
  onRetry: () => void;
}) {
  if (errorCode === "AUTH_ERROR") {
    return (
      <div className="py-2 px-3 space-y-2">
        <div className="flex items-center gap-2 text-error">
          <Settings className="h-4 w-4 shrink-0" />
          <span className="text-sm font-sans">
            No AI provider configured. Please set up a provider in AI Settings.
          </span>
        </div>
      </div>
    );
  }

  if (errorCode === "NETWORK_ERROR") {
    return (
      <div className="py-2 px-3 space-y-2">
        <ErrorBanner message="Network error. Please check your connection." />
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (errorCode === "RATE_LIMITED") {
    return (
      <div className="py-2 px-3 space-y-2">
        <div className="flex items-center gap-2 text-text-secondary dark:text-text-secondary-dark">
          <Clock className="h-4 w-4 shrink-0" />
          <span className="text-sm font-sans">
            Too many requests. Please wait a moment and try again.
          </span>
        </div>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  // Default: generic error with retry
  return (
    <div className="py-2 px-3 space-y-2">
      <ErrorBanner message={error} />
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Retry
      </Button>
    </div>
  );
}

/**
 * Pure view component — exported for direct testing with renderToString.
 */
export function ChatDrawerView({
  isOpen,
  onClose,
  view = "conversation",
  bookId,
  messages,
  streamingText,
  status,
  error,
  errorCode,
  onSend,
  onRetry,
  onBackToList,
  onNewChat,
  initialMessage,
  isIndexing = false,
  ragError,
  onRetryIndexing,
}: ChatDrawerViewProps) {
  const isStreaming = status === "loading" || status === "streaming";
  const isEmpty = messages.length === 0 && !isStreaming && !isIndexing;

  return (
    <Drawer open={isOpen} onClose={onClose} title="AI Chat">
      <div className="flex flex-col h-full">
        {/* List view: session list */}
        {view === "list" && bookId && (
          <SessionList bookId={bookId} onNewChat={onNewChat} />
        )}

        {/* Conversation view */}
        {view === "conversation" && (
          <>
            {/* Back to list button */}
            <div className="shrink-0 px-2 pb-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={onBackToList}
                className="flex items-center gap-1 border-transparent"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to conversations
              </Button>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto">
              {isIndexing && isEmpty ? (
                <IndexingEmptyState />
              ) : isEmpty ? (
                <WelcomeEmptyState onSend={onSend} />
              ) : (
                <MessageList
                  messages={
                    isStreaming && streamingText
                      ? [
                          ...messages.slice(0, -1),
                          {
                            ...messages[messages.length - 1],
                            content: streamingText,
                          },
                        ]
                      : messages
                  }
                />
              )}
            </div>

            {/* Typing indicator during streaming */}
            {status === "streaming" && <TypingIndicator />}

            {/* Loading indicator */}
            {status === "loading" && (
              <div className="flex items-center gap-2 py-2 px-3">
                <Loader2 className="animate-spin h-4 w-4 text-text-secondary dark:text-text-secondary-dark" />
                <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-sans">
                  Thinking…
                </span>
              </div>
            )}

            {/* Subtle indexing indicator when messages already exist */}
            {isIndexing && !isEmpty && <IndexingIndicator />}

            {/* RAG indexing error banner */}
            {ragError && (
              <div className="py-2 px-3 space-y-2">
                <div className="flex items-center gap-2 text-text-secondary dark:text-text-secondary-dark">
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-sans">
                    Book context unavailable — using plain AI.
                  </span>
                </div>
                {onRetryIndexing && (
                  <Button variant="secondary" size="sm" onClick={onRetryIndexing}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Retry indexing
                  </Button>
                )}
              </div>
            )}

            {/* Error banner */}
            {status === "error" && error && (
              <ChatErrorBanner error={error} errorCode={errorCode} onRetry={onRetry} />
            )}

            {/* Input area */}
            <div className="shrink-0">
              <ChatInput onSend={onSend} disabled={isStreaming} initialValue={initialMessage} />
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Stateful Wrapper
// ---------------------------------------------------------------------------

interface ChatDrawerProps {
  /** Whether the drawer is visible */
  isOpen: boolean;
  /** Callback when the drawer should close */
  onClose: () => void;
  /** Current book ID for filtering conversations. Falls back to useBookStore if omitted. */
  bookId?: string;
  /** Initial message to pre-fill the chat input (e.g., from "Ask AI" selection) */
  initialMessage?: string;
}

/**
 * Stateful wrapper — mounts, loads conversations from store, wires up
 * streaming hook, and syncs completed messages back to the store.
 *
 * Supports two views: "list" (session list) and "conversation" (chat).
 * Defaults to conversation view when a conversation is active, list view otherwise.
 */
export function ChatDrawer({ isOpen, onClose, bookId: bookIdProp, initialMessage }: ChatDrawerProps) {
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

  const handleSend = useCallback(
    async (content: string) => {
      // Debounce: reject rapid consecutive sends
      const now = Date.now();
      if (now - lastSendTimeRef.current < DEBOUNCE_MIN_MS) {
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

  const handleRetry = useCallback(() => {
    if (lastContentRef.current) {
      handleSend(lastContentRef.current);
    }
  }, [handleSend]);

  // Retry RAG indexing — re-triggers the hook's internal state by sending last query
  const handleRetryIndexing = useCallback(() => {
    // Clear the RAG error by asking a simple question which will re-trigger indexing
    rag.askQuestion("retry");
  }, [rag]);

  return (
    <ChatDrawerView
      isOpen={isOpen}
      onClose={onClose}
      view={view}
      bookId={bookId}
      messages={messages}
      streamingText={streamingText}
      status={status}
      error={error}
      errorCode={errorCode}
      onSend={handleSend}
      onStop={stopStreaming}
      onRetry={handleRetry}
      onBackToList={handleBackToList}
      onNewChat={handleNewChat}
      initialMessage={initialMessage}
      isIndexing={rag.isIndexing}
      ragError={rag.error}
      onRetryIndexing={handleRetryIndexing}
    />
  );
}
