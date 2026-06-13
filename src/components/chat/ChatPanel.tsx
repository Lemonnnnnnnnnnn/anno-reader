/**
 * ChatPanel component.
 *
 * A reusable chat container that provides the standard chat layout:
 * - Optional context header (e.g., selected text, note content)
 * - Scrollable message list
 * - Error banner
 * - Chat input
 * - Footer with action buttons
 *
 * This component is designed to be used by both AITranslationPanel
 * and AnnotationDetailDrawer for consistent chat behavior.
 *
 * @example
 * ```tsx
 * <ChatPanel
 *   messages={chatMessages}
 *   streamingText={chatStreamingText}
 *   isStreaming={isChatStreaming}
 *   status={chatStatus}
 *   onSend={handleChatSend}
 *   onStop={chatStopStreaming}
 *   onClose={onClose}
 *   contextText="Selected passage..."
 *   inputPlaceholder="Ask about this text…"
 * />
 * ```
 */

import { useCallback } from "react";
import { Button, ErrorBanner } from "@/components/primitives";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import type { ChatMessage } from "@/lib/chat/types";
import type { ChatStreamingStatus } from "@/lib/chat/streaming";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatPanelProps {
  /** Chat messages to display */
  messages: ChatMessage[];
  /** Text being streamed in real-time (before committed to messages) */
  streamingText?: string;
  /** Current streaming status */
  status: ChatStreamingStatus;
  /** Whether streaming is in progress */
  isStreaming: boolean;
  /** Callback when user sends a message */
  onSend: (content: string) => void;
  /** Callback to stop streaming */
  onStop: () => void;
  /** Callback to close the chat panel */
  onClose: () => void;
  /** Optional context text shown above messages (e.g., selected passage) */
  contextText?: string;
  /** Maximum lines to show for context text (default: 2) */
  contextMaxLines?: number;
  /** Placeholder text for the input */
  inputPlaceholder?: string;
  /** Custom error message (overrides status-based error) */
  errorMessage?: string;
  /** Custom footer content (replaces default footer) */
  footer?: React.ReactNode;
  /** Additional CSS classes for the container */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatPanel({
  messages,
  streamingText,
  status,
  isStreaming,
  onSend,
  onStop,
  onClose,
  contextText,
  contextMaxLines = 2,
  inputPlaceholder = "Ask a question…",
  errorMessage,
  footer,
  className,
}: ChatPanelProps) {
  // Build display messages: if streaming, replace last assistant message with streaming text
  const displayMessages = useCallback((): ChatMessage[] => {
    if (isStreaming && streamingText && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "assistant") {
        return [
          ...messages.slice(0, -1),
          { ...lastMsg, content: streamingText },
        ];
      }
    }
    return messages;
  }, [messages, streamingText, isStreaming]);

  // Determine error message
  const error = errorMessage ?? (status === "error" ? "Chat response failed" : null);

  // Default footer
  const defaultFooter = (
    <div className="shrink-0 flex items-center justify-between gap-2 pt-2 mt-1 border-t border-border dark:border-border-dark">
      <div />
      <div className="flex items-center gap-2">
        {isStreaming && (
          <Button variant="secondary" size="sm" onClick={onStop}>
            Stop
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col h-full ${className ?? ""}`}>
      {/* Context text (optional) */}
      {contextText && (
        <div className="shrink-0 px-1 pb-2">
          <p
            className={`text-xs text-text-secondary dark:text-text-secondary-dark font-sans ${
              contextMaxLines === 2 ? "line-clamp-2" : 
              contextMaxLines === 3 ? "line-clamp-3" : 
              contextMaxLines === 4 ? "line-clamp-4" : "line-clamp-5"
            }`}
          >
            {contextText}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <MessageList messages={displayMessages()} />
      </div>

      {/* Error */}
      {error && (
        <div className="shrink-0 px-1">
          <ErrorBanner message={error} />
        </div>
      )}

      {/* Input */}
      <div className="shrink-0">
        <ChatInput
          onSend={onSend}
          disabled={isStreaming}
          placeholder={inputPlaceholder}
        />
      </div>

      {/* Footer */}
      {footer ?? defaultFooter}
    </div>
  );
}
