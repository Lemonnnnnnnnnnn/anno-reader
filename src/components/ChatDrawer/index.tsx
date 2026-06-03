/**
 * @deprecated Barrel export is in index.ts — this file is not used.
 */

// ---------------------------------------------------------------------------
// View Component
// ---------------------------------------------------------------------------

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
  onSend,
  onStop,
}: ChatDrawerViewProps) {
  const isStreaming = status === "loading" || status === "streaming";

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="AI Chat">
      <div className="flex flex-col h-full">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
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
        </div>

        {/* Loading indicator */}
        {status === "loading" && (
          <div className="flex items-center gap-2 py-2 px-1">
            <Loader2 className="animate-spin h-4 w-4 text-text-secondary dark:text-text-secondary-dark" />
            <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-sans">
              Thinking…
            </span>
          </div>
        )}

        {/* Error banner */}
        {status === "error" && error && (
          <div className="py-2">
            <ErrorBanner message={error} />
          </div>
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
    isLoaded,
    currentConversationId,
    createConversation,
  } = useChatStore();

  // Streaming integration — active chat session
  const {
    messages,
    streamingText,
    status,
    error,
    sendChatMessage,
    stopStreaming,
  } = useChatStreaming(storeMessages);

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
      // Ensure conversation exists before sending
      if (!currentConversationId) {
        createConversation(crypto.randomUUID());
      }

      // Persist user message to store immediately
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        createdAt: Date.now(),
      };
      addMessage(userMessage);

      // Send via streaming (handles user + assistant messages internally)
      await sendChatMessage(content);
    },
    [currentConversationId, createConversation, addMessage, sendChatMessage],
  );

  return (
    <ChatDrawerView
      isOpen={isOpen}
      onClose={onClose}
      messages={messages}
      streamingText={streamingText}
      status={status}
      error={error}
      onSend={handleSend}
      onStop={stopStreaming}
    />
  );
}
