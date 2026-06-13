import { useState, useCallback } from "react";
import { Button, ErrorBanner, Drawer, TextArea } from "@/components/primitives";
import { Loader2, Volume2, MessageSquare } from "lucide-react";
import { Streamdown } from "streamdown";
import { MessageList } from "@/components/ChatDrawer/MessageList";
import { ChatInput } from "@/components/ChatDrawer/ChatInput";
import { useTranslation, useNoteSaving } from "./hooks";
import { useChatStreaming } from "@/lib/chat/streaming";
import { useTTS } from "@/hooks/useTTS";
import type { PanelStatus } from "./hooks";
import type { ChatMessage } from "@/lib/chat/types";
import type { ChatStreamingStatus } from "@/lib/chat/streaming";

interface AITranslationPanelProps {
  selectedText: string;
  chapterText: string | null;
  chapterHref: string;
  cfiRange: string;
  startOffset: number;
  endOffset: number;
  /** The sentence containing the selection (for AI context) */
  sentence?: string;
  isOpen?: boolean;
  onClose: () => void;
}

export type { PanelStatus };

/**
 * Pure view component — exported for direct testing with renderToString.
 */
export function AITranslationPanelView({
  status,
  selectedText,
  translationText,
  streamingText,
  error,
  isSaving,
  isOpen = true,
  onClose,
  onRetry,
  onAddNote,
  onStop,
  onTranslationChange,
  isTTSAvailable,
  isSpeaking,
  onSpeak,
  chatMode,
  onEnterChat,
  onExitChat,
  chatMessages,
  chatStreamingText,
  chatStatus,
  onChatSend,
  onChatStop,
}: {
  status: PanelStatus;
  selectedText: string;
  translationText: string;
  streamingText: string;
  error: string | null;
  isSaving: boolean;
  isOpen?: boolean;
  onClose: () => void;
  onRetry: () => void;
  onAddNote: () => void;
  onStop: () => void;
  onTranslationChange: (text: string) => void;
  isTTSAvailable: boolean;
  isSpeaking: boolean;
  onSpeak: () => void;
  /** Chat continuation props */
  chatMode: boolean;
  onEnterChat: () => void;
  onExitChat: () => void;
  chatMessages: ChatMessage[];
  chatStreamingText: string;
  chatStatus: ChatStreamingStatus;
  onChatSend: (content: string) => void;
  onChatStop: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(translationText);

  const handleEdit = useCallback(() => {
    setEditedText(translationText);
    setIsEditing(true);
  }, [translationText]);

  const handleSave = useCallback(() => {
    onTranslationChange(editedText);
    setIsEditing(false);
  }, [editedText, onTranslationChange]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const isChatStreaming = chatStatus === "loading" || chatStatus === "streaming";

  return (
    <Drawer open={isOpen} onClose={onClose} title="AI Translation">
      <div className="flex flex-col h-full">
        {/* Chat mode: show message list + input */}
        {chatMode ? (
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
        ) : (
          <>
            {/* Translation mode: original flow */}
            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto space-y-4 min-h-0 flex flex-col">
              {/* Original text */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-text-secondary dark:text-text-secondary-dark font-sans">
                    Original
                  </label>
                  {isTTSAvailable && (
                    <button
                      onClick={onSpeak}
                      className={`p-1 rounded transition-opacity ${isSpeaking ? "opacity-100" : "opacity-50 hover:opacity-75"
                        }`}
                      title={isSpeaking ? "Stop speaking" : "Listen"}
                    >
                      <Volume2 size={14} className="text-text-secondary dark:text-text-secondary-dark" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-text dark:text-text-dark bg-bg dark:bg-bg-dark rounded-md p-3 font-serif leading-relaxed">
                  {selectedText}
                </p>
              </div>

              {/* Loading state */}
              {status === "loading" && (
                <div className="flex items-center gap-2 py-6 justify-center">
                  <Loader2 className="animate-spin h-5 w-5 text-text-secondary dark:text-text-secondary-dark" />
                  <span className="text-sm text-text-secondary dark:text-text-secondary-dark font-sans">
                    Translating…
                  </span>
                </div>
              )}

              {/* Streaming state */}
              {status === "streaming" && (
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-text-secondary dark:text-text-secondary-dark mb-1 font-sans">
                    Translation
                  </label>
                  <div className="text-sm text-text dark:text-text-dark font-serif leading-relaxed">
                    <Streamdown mode="streaming" isAnimating={true}>
                      {streamingText}
                    </Streamdown>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onStop}
                  >
                    Stop
                  </Button>
                </div>
              )}

              {/* Error state */}
              {status === "error" && (
                <div className="space-y-3">
                  <ErrorBanner message={error ?? "Translation failed"} />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onRetry}
                  >
                    Retry
                  </Button>
                </div>
              )}

              {/* Success state - editable */}
              {status === "success" && (
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="block text-xs font-medium text-text-secondary dark:text-text-secondary-dark mb-1 font-sans">
                    Translation
                  </label>
                  {isEditing ? (
                    <TextArea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      onSubmit={handleSave}
                      onCancel={handleCancel}
                      className="flex-1 min-h-0"
                    />
                  ) : (
                    <div className="text-sm text-text dark:text-text-dark font-serif leading-relaxed">
                      <Streamdown mode="static" isAnimating={false}>
                        {translationText}
                      </Streamdown>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 flex items-center justify-end gap-2 pt-3 mt-2 border-t border-border dark:border-border-dark">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
              {status === "success" && !isEditing && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleEdit}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onEnterChat}
                  >
                    Continue Chat
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onAddNote}
                    loading={isSaving}
                  >
                    Add as Note
                  </Button>
                </>
              )}
              {isEditing && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSave}
                  >
                    Save
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

/**
 * Stateful wrapper — mounts, auto-translates, wires up store actions.
 */
export function AITranslationPanel({
  selectedText,
  chapterText,
  chapterHref,
  cfiRange,
  startOffset,
  sentence,
  isOpen = true,
  onClose,
}: AITranslationPanelProps) {
  const {
    status,
    translationText,
    streamingText,
    error,
    setError,
    setTranslationText,
    translate,
    stopTranslation,
  } = useTranslation({ selectedText, chapterText, offset: startOffset, selectionSentence: sentence });

  const { isSaving, handleAddNote } = useNoteSaving({
    chapterHref,
    cfiRange,
    selectedText,
    translationText,
    onClose,
    onError: setError,
  });

  const { speak, isSpeaking } = useTTS(selectedText);

  // Chat continuation state
  const [chatMode, setChatMode] = useState(false);
  const {
    messages: chatMessages,
    streamingText: chatStreamingText,
    status: chatStatus,
    sendChatMessage,
    stopStreaming: chatStopStreaming,
    reset: chatReset,
  } = useChatStreaming();

  // Build a system message that gives the AI full context about the translation
  const buildChatSystemMessage = useCallback(
    (translation: string) => {
      const parts = [
        "You are a helpful language and translation assistant.",
        "The user is reading a book and selected a passage for translation.",
        "Below is the context. Continue the conversation naturally — answer follow-up questions, explain nuances, provide examples, etc.",
        "",
        `## Original text\n${selectedText}`,
        "",
        `## Translation\n${translation}`,
      ];
      if (sentence) {
        parts.push("", `## Surrounding sentence\n${sentence}`);
      }
      if (chapterText) {
        // Truncate chapter context to avoid token overflow
        const truncated = chapterText.length > 2000
          ? chapterText.slice(0, 2000) + "…"
          : chapterText;
        parts.push("", `## Chapter context\n${truncated}`);
      }
      return parts.join("\n");
    },
    [selectedText, sentence, chapterText],
  );

  // Enter chat mode: seed conversation with translation as context
  const handleEnterChat = useCallback(() => {
    const systemMsg = buildChatSystemMessage(translationText);

    // Seed with the translation exchange as initial context
    const seedMessages: ChatMessage[] = [
      {
        id: crypto.randomUUID(),
        role: "user",
        content: `Please translate and explain: ${selectedText}`,
        createdAt: Date.now(),
      },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: translationText,
        createdAt: Date.now(),
      },
    ];

    chatReset(seedMessages);
    // Store system message for subsequent sends
    setChatSystemMessage(systemMsg);
    setChatMode(true);
  }, [translationText, selectedText, buildChatSystemMessage, chatReset]);

  // Store system message for chat sends
  const [chatSystemMessage, setChatSystemMessage] = useState("");

  // Exit chat mode
  const handleExitChat = useCallback(() => {
    chatStopStreaming();
    chatReset([]);
    setChatMode(false);
  }, [chatStopStreaming, chatReset]);

  // Send chat message with system context
  const handleChatSend = useCallback(
    (content: string) => {
      void sendChatMessage(content, chatSystemMessage);
    },
    [sendChatMessage, chatSystemMessage],
  );

  return (
    <AITranslationPanelView
      status={status}
      selectedText={selectedText}
      translationText={translationText}
      streamingText={streamingText}
      error={error}
      isSaving={isSaving}
      isOpen={isOpen}
      onClose={onClose}
      onRetry={translate}
      onAddNote={handleAddNote}
      onStop={stopTranslation}
      onTranslationChange={setTranslationText}
      isTTSAvailable={true}
      isSpeaking={isSpeaking}
      onSpeak={speak}
      chatMode={chatMode}
      onEnterChat={handleEnterChat}
      onExitChat={handleExitChat}
      chatMessages={chatMessages}
      chatStreamingText={chatStreamingText}
      chatStatus={chatStatus}
      onChatSend={handleChatSend}
      onChatStop={chatStopStreaming}
    />
  );
}
