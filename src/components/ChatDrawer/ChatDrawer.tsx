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

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bug, Loader2 } from "lucide-react";
import { Drawer, Modal, Button } from "@/components/primitives";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { SessionList } from "./SessionList";
import { TypingIndicator } from "./TypingIndicator";
import { WelcomeEmptyState } from "./WelcomeEmptyState";
import { ChatErrorBanner } from "./ChatErrorBanner";
import { ChatDebugModal } from "./ChatDebugModal";
import { useChatDrawer } from "./hooks";
import { usePreferencesStore } from "@/stores/usePreferencesStore";
import type { ChatMessage, ContextChapter } from "@/lib/chat/types";
import type { ChatStreamingStatus } from "@/lib/chat/streaming";
import type { ChatRequestDebugInfo } from "@/lib/chat/context";
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
  /** Chapter snapshot bound to the active conversation (null = no context) */
  contextChapter: ContextChapter | null;
  /** Bind the current reader chapter to the conversation, or unbind */
  onToggleChapterContext: (checked: boolean) => void;
  /** Whether chapter context is available in the reader (hides the checkbox otherwise) */
  hasChapterContext: boolean;
  /** Snapshot of the request the next send would produce (debug panel) */
  buildDebugInfo: () => ChatRequestDebugInfo;
  /** Container style: side drawer (component default) or centered modal (store default) */
  variant?: "drawer" | "modal";
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
  contextChapter,
  onToggleChapterContext,
  hasChapterContext,
  buildDebugInfo,
  variant = "drawer",
}: ChatDrawerViewProps) {
  const isStreaming = status === "loading" || status === "streaming";
  const isEmpty = messages.length === 0 && !isStreaming;

  // Debug panel state — info is snapshotted when the panel opens
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<ChatRequestDebugInfo | null>(null);
  const handleOpenDebug = () => {
    setDebugInfo(buildDebugInfo());
    setDebugOpen(true);
  };

  // The outer wrapper is the real scroll container (MessageList grows with
  // its content, so its own overflow never kicks in). Land on the latest
  // message when the chat opens, when a conversation is selected, and when
  // messages are added.
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const scrollToLatestMessage = useCallback(() => {
    const el = messagesScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    if (isOpen && view === "conversation") {
      scrollToLatestMessage();
    }
  }, [isOpen, view, scrollToLatestMessage]);

  useEffect(() => {
    scrollToLatestMessage();
  }, [messages.length, scrollToLatestMessage]);

  const chatBody = (
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
          <div ref={messagesScrollRef} className="flex-1 overflow-y-auto">
            {isEmpty ? (
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

          {/* Error banner */}
          {status === "error" && error && (
            <ChatErrorBanner error={error} errorCode={errorCode} onRetry={onRetry} />
          )}

          {/* Chapter context checkbox + debug access */}
          <div className="shrink-0 flex items-center justify-between gap-2 pl-3 pr-2 pb-1.5">
            {hasChapterContext ? (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={contextChapter !== null}
                  onChange={(e) => onToggleChapterContext(e.target.checked)}
                  className="accent-accent dark:accent-accent-dark cursor-pointer"
                />
                <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">
                  {contextChapter
                    ? `引用章节全文 · ${contextChapter.title}`
                    : "引用当前章节全文"}
                </span>
              </label>
            ) : (
              <span />
            )}
            <Button
              variant="icon"
              onClick={handleOpenDebug}
              title="调试信息"
              aria-label="Open chat debug panel"
            >
              <Bug size={14} />
            </Button>
          </div>

          {/* Input area */}
          <div className="shrink-0">
            <ChatInput onSend={onSend} disabled={isStreaming} initialValue={initialMessage} />
          </div>
        </>
      )}
    </div>
  );

  if (variant === "modal") {
    // The modal body grows with its content, so the chat needs an explicit
    // bounded height (the drawer variant fills the viewport instead).
    return (
      <>
        <Modal open={isOpen} onClose={onClose} title="AI Chat" size="wide">
          <div className="h-[70vh]">{chatBody}</div>
        </Modal>
        <ChatDebugModal
          open={debugOpen}
          onClose={() => setDebugOpen(false)}
          info={debugInfo}
        />
      </>
    );
  }

  return (
    <Drawer open={isOpen} onClose={onClose} title="AI Chat">
      {chatBody}
      <ChatDebugModal
        open={debugOpen}
        onClose={() => setDebugOpen(false)}
        info={debugInfo}
      />
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
  /** href of the chapter currently open in the reader (hides the context checkbox when omitted) */
  currentChapterHref?: string | null;
  /** Resolve a chapter (href/title/full text) by href, for the bound context chapter */
  resolveChapterContext?: (href: string) => import("@/lib/chat/context").ChapterContext | null;
}

/**
 * Stateful wrapper — uses useChatDrawer hook for store/streaming/context
 * integration and passes derived state to ChatDrawerView.
 *
 * Supports two views: "list" (session list) and "conversation" (chat).
 * Defaults to conversation view when a conversation is active, list view otherwise.
 */
export function ChatDrawer({
  isOpen,
  onClose,
  bookId,
  initialMessage,
  currentChapterHref,
  resolveChapterContext,
}: ChatDrawerProps) {
  const chatLayout = usePreferencesStore((s) => s.chatLayout);
  const drawer = useChatDrawer({
    isOpen,
    bookId,
    initialMessage,
    currentChapterHref,
    resolveChapterContext,
  });

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
      contextChapter={drawer.contextChapter}
      onToggleChapterContext={drawer.onToggleChapterContext}
      hasChapterContext={Boolean(currentChapterHref && resolveChapterContext)}
      buildDebugInfo={drawer.buildDebugInfo}
      variant={chatLayout}
    />
  );
}
