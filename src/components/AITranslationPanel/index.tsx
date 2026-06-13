import { useState, useCallback } from "react";
import { Drawer } from "@/components/primitives";
import { useTranslation, useNoteSaving } from "./hooks";
import { useChatStreaming } from "@/lib/chat/streaming";
import { useTTS } from "@/hooks/useTTS";
import { ChatMode } from "./ChatMode";
import { TranslationMode } from "./TranslationMode";
import type { PanelStatus } from "./hooks";
import type { ChatMessage } from "@/lib/chat/types";

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
 * AI Translation Panel — mounts, auto-translates, wires up store actions.
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

  const isChatStreaming = chatStatus === "loading" || chatStatus === "streaming";

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
    <Drawer open={isOpen} onClose={onClose} title="AI Translation">
      <div className="flex flex-col h-full">
        {chatMode ? (
          <ChatMode
            selectedText={selectedText}
            chatMessages={chatMessages}
            chatStreamingText={chatStreamingText}
            chatStatus={chatStatus}
            isChatStreaming={isChatStreaming}
            onChatSend={handleChatSend}
            onChatStop={chatStopStreaming}
            onExitChat={handleExitChat}
            onClose={onClose}
          />
        ) : (
          <TranslationMode
            status={status}
            selectedText={selectedText}
            translationText={translationText}
            streamingText={streamingText}
            error={error}
            isSaving={isSaving}
            onClose={onClose}
            onRetry={translate}
            onAddNote={handleAddNote}
            onStop={stopTranslation}
            onTranslationChange={setTranslationText}
            isTTSAvailable={true}
            isSpeaking={isSpeaking}
            onSpeak={speak}
            onEnterChat={handleEnterChat}
          />
        )}
      </div>
    </Drawer>
  );
}
