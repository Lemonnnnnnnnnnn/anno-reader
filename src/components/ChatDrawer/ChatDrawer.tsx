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

import { useEffect, useCallback, useRef } from "react";
import { Loader2, Bot, BookOpen, Lightbulb, HelpCircle, Settings, RefreshCw, Clock } from "lucide-react";
import { Drawer } from "@/components/Drawer";
import { Button, ErrorBanner } from "@/components/primitives";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { useChatStore } from "@/stores/useChatStore";
import { useChatStreaming } from "@/lib/chat/streaming";
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
function WelcomeEmptyState() {
  const tips = [
    { icon: BookOpen, text: "Ask about this book" },
    { icon: Lightbulb, text: "Request a summary" },
    { icon: HelpCircle, text: "Explain a passage" },
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
        {tips.map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-alt dark:bg-surface-alt-dark"
          >
            <Icon className="h-4 w-4 text-text-secondary dark:text-text-secondary-dark shrink-0" />
            <span className="text-sm text-text-secondary dark:text-text-secondary-dark font-sans">
              {text}
            </span>
          </div>
        ))}
      </div>
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
  messages,
  streamingText,
  status,
  error,
  errorCode,
  onSend,
  onRetry,
}: ChatDrawerViewProps) {
  const isStreaming = status === "loading" || status === "streaming";
  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="AI Chat">
      <div className="flex flex-col h-full">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <WelcomeEmptyState />
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

        {/* Error banner */}
        {status === "error" && error && (
          <ChatErrorBanner error={error} errorCode={errorCode} onRetry={onRetry} />
        )}

        {/* Input area */}
        <div className="shrink-0">
          <ChatInput onSend={onSend} disabled={isStreaming} />
        </div>
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
}

/**
 * Stateful wrapper — mounts, loads conversations from store, wires up
 * streaming hook, and syncs completed messages back to the store.
 */
export function ChatDrawer({ isOpen, onClose }: ChatDrawerProps) {
  // Store integration — conversation persistence
  const {
    messages: storeMessages,
    addMessage,
    loadConversations,
    currentConversationId,
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
  } = useChatStreaming(storeMessages);

  // Refs for debounce and retry
  const lastSendTimeRef = useRef(0);
  const lastContentRef = useRef<string | null>(null);

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
        createConversation(crypto.randomUUID());
      }

      // Send via streaming (handles user + assistant messages internally)
      await sendChatMessage(content);
    },
    [currentConversationId, createConversation, sendChatMessage],
  );

  const handleRetry = useCallback(() => {
    if (lastContentRef.current) {
      handleSend(lastContentRef.current);
    }
  }, [handleSend]);

  return (
    <ChatDrawerView
      isOpen={isOpen}
      onClose={onClose}
      messages={messages}
      streamingText={streamingText}
      status={status}
      error={error}
      errorCode={errorCode}
      onSend={handleSend}
      onStop={stopStreaming}
      onRetry={handleRetry}
    />
  );
}
