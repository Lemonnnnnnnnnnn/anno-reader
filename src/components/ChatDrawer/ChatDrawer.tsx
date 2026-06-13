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

import { ArrowLeft, Loader2 } from "lucide-react";
import { Drawer, Button } from "@/components/primitives";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { SessionList } from "./SessionList";
import { TypingIndicator } from "./TypingIndicator";
import { WelcomeEmptyState } from "./WelcomeEmptyState";
import { IndexingEmptyState } from "./IndexingEmptyState";
import { IndexingIndicator } from "./IndexingIndicator";
import { ChatErrorBanner } from "./ChatErrorBanner";
import { useChatDrawer } from "./hooks";
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
                  <span className="text-xs font-sans">
                    Book context unavailable — using plain AI.
                  </span>
                </div>
                {onRetryIndexing && (
                  <Button variant="secondary" size="sm" onClick={onRetryIndexing}>
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
 * Stateful wrapper — uses useChatDrawer hook for store/streaming/RAG
 * integration and passes derived state to ChatDrawerView.
 *
 * Supports two views: "list" (session list) and "conversation" (chat).
 * Defaults to conversation view when a conversation is active, list view otherwise.
 */
export function ChatDrawer({ isOpen, onClose, bookId, initialMessage }: ChatDrawerProps) {
  const drawer = useChatDrawer({ isOpen, bookId, initialMessage });

  return (
    <ChatDrawerView
      isOpen={isOpen}
      onClose={onClose}
      view={drawer.view}
      bookId={drawer.bookId}
      messages={drawer.messages}
      streamingText={drawer.streamingText}
      status={drawer.status}
      error={drawer.error}
      errorCode={drawer.errorCode}
      onSend={drawer.onSend}
      onStop={drawer.onStop}
      onRetry={drawer.onRetry}
      onBackToList={drawer.onBackToList}
      onNewChat={drawer.onNewChat}
      initialMessage={initialMessage}
      isIndexing={drawer.isIndexing}
      ragError={drawer.ragError}
      onRetryIndexing={drawer.onRetryIndexing}
    />
  );
}
