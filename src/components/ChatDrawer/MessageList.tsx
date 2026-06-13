/**
 * MessageList component.
 *
 * Displays a scrollable list of chat messages with role-based alignment:
 * user messages right-aligned with accent styling, AI messages left-aligned
 * with surface styling. AI message content is rendered as Markdown via
 * react-markdown + remark-gfm.
 *
 * @example
 * ```tsx
 * <MessageList messages={chatMessages} />
 * ```
 */

import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check } from "lucide-react";
import type { ChatMessage } from "@/lib/chat/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MessageListProps {
  /** Messages to render, ordered chronologically */
  messages: ChatMessage[];
}

// ---------------------------------------------------------------------------
// Timestamp Formatting
// ---------------------------------------------------------------------------

/**
 * Format a Unix timestamp (ms) into a short human-readable string.
 * Shows time only for today, adds date for older messages.
 */
function formatTimestamp(createdAt: number): string {
  const date = new Date(createdAt);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return time;

  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${time}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Single chat message bubble with role-based styling.
 */
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [message.content]);

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      {/* Message content */}
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-accent dark:bg-accent-dark text-white rounded-br-sm"
            : "bg-surface-alt dark:bg-surface-alt-dark text-text dark:text-text-dark rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <div className="font-serif markdown-note">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Timestamp + copy button */}
      <div className={`mt-1 flex items-center gap-1 px-1 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        <span className="text-[0.72rem] text-text-muted dark:text-text-muted-dark">
          {formatTimestamp(message.createdAt)}
        </span>
        {!isUser && (
          <button
            onClick={handleCopy}
            className="p-0.5 rounded text-text-muted dark:text-text-muted-dark hover:text-text-secondary dark:hover:text-text-secondary-dark transition-colors"
            title="Copy"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageList({ messages }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message when messages change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scroll to bottom smoothly
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-text-muted dark:text-text-muted-dark font-sans">
          Start a conversation...
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto space-y-3 py-2"
      data-testid="message-list"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}
