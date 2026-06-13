import { Button } from "@/components/primitives";
import { ChatPanel } from "@/components/chat";
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
 * Uses the generic ChatPanel component with translation-specific footer.
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
    <ChatPanel
      messages={chatMessages}
      streamingText={chatStreamingText}
      status={chatStatus}
      isStreaming={isChatStreaming}
      onSend={onChatSend}
      onStop={onChatStop}
      onClose={onClose}
      contextText={selectedText}
      inputPlaceholder="Ask about this translation…"
      footer={
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
      }
    />
  );
}
