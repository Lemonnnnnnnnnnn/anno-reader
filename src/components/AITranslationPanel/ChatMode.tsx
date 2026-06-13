import { Button, ErrorBanner } from "@/components/primitives";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import type { ChatMessage } from "@/lib/chat/types";
import type { ChatStreamingStatus } from "@/lib/chat/streaming";

interface ChatModeProps {
  selectedText: string;
  chatMessages: ChatMessage[];
  chatStreamingText: string;
  chatStatus: ChatStreamingStatus;
  isChatStreaming: boolean;
  onChatSend: (content: string) => void;
  onChatStop: () => void;
  onExitChat: () => void;
  onClose: () => void;
}

/**
 * Chat continuation mode — shows message list and input for follow-up questions.
 */
export function ChatMode({
  selectedText,
  chatMessages,
  chatStreamingText,
  chatStatus,
  isChatStreaming,
  onChatSend,
  onChatStop,
  onExitChat,
  onClose,
}: ChatModeProps) {
  return (
    <>
      {/* Original text (collapsed) */}
      <div className="shrink-0 px-1 pb-2">
        <p className="text-xs text-text-secondary dark:text-text-secondary-dark font-sans line-clamp-2">
          {selectedText}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <MessageList messages={
          isChatStreaming && chatStreamingText
            ? [
                ...chatMessages.slice(0, -1),
                {
                  ...chatMessages[chatMessages.length - 1],
                  content: chatStreamingText,
                },
              ]
            : chatMessages
        } />
      </div>

      {/* Chat error */}
      {chatStatus === "error" && (
        <div className="shrink-0 px-1">
          <ErrorBanner message="Chat response failed" />
        </div>
      )}

      {/* Chat input */}
      <div className="shrink-0">
        <ChatInput
          onSend={onChatSend}
          disabled={isChatStreaming}
          placeholder="Ask about this translation…"
        />
      </div>

      {/* Chat footer */}
      <div className="shrink-0 flex items-center justify-between gap-2 pt-2 mt-1 border-t border-border dark:border-border-dark">
        <Button variant="secondary" size="sm" onClick={onExitChat}>
          Back to Translation
        </Button>
        <div className="flex items-center gap-2">
          {isChatStreaming && (
            <Button variant="secondary" size="sm" onClick={onChatStop}>
              Stop
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </>
  );
}
