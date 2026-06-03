/**
 * Chat streaming module.
 *
 * Provides:
 * - `sendMessage`: Standalone function to send messages via streaming AI response.
 * - `useChatStreaming`: React hook for managing streaming chat state.
 *
 * Uses the same AI SDK (`@ai-sdk/openai-compatible` + `streamText`) pattern
 * as the translation module for consistency.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, APICallError } from "ai";
import { useAIConfigStore } from "@/stores/useAIConfigStore";
import { AIServiceError, type AIServiceErrorCode } from "@/lib/ai/service";
import type { AIProvider } from "@/lib/ai/types";
import type { ChatMessage } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for sendMessage. */
export interface SendMessageOptions {
  /** AbortSignal to cancel the stream. */
  abortSignal?: AbortSignal;
  /** Callback invoked when a streaming chunk arrives (for real-time UI). */
  onChunk?: (chunk: string, accumulated: string) => void;
  /** Callback invoked when an error occurs mid-stream. */
  onError?: (error: Error) => void;
}

/** Result returned by sendMessage. */
export interface SendMessageResult {
  /** The complete assistant response text. */
  content: string;
  /** The provider used for the response. */
  provider: AIProvider;
}

// ---------------------------------------------------------------------------
// Error Mapping
// ---------------------------------------------------------------------------

/**
 * Map unknown errors to AIServiceError, matching the provider pattern.
 */
function toChatError(error: unknown): AIServiceError {
  if (error instanceof AIServiceError) {
    return error;
  }

  if (error instanceof APICallError) {
    const status = error.statusCode;
    if (status === 401 || status === 403) {
      return new AIServiceError("AUTH_ERROR", error.message);
    }
    if (status === 429) {
      return new AIServiceError("RATE_LIMITED", error.message, true);
    }
    if (status !== undefined && status >= 500) {
      return new AIServiceError("API_ERROR", error.message, true);
    }
    return new AIServiceError("API_ERROR", error.message, error.isRetryable);
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  return new AIServiceError(
    "NETWORK_ERROR",
    `Failed to connect to provider: ${message}`,
    true,
  );
}

// ---------------------------------------------------------------------------
// sendMessage
// ---------------------------------------------------------------------------

/**
 * Send a conversation to an AI provider and stream the response.
 *
 * Converts ChatMessage[] to the AI SDK's CoreMessage format,
 * calls `streamText` with the provider config, and returns
 * the accumulated response.
 *
 * @param messages - Conversation history (user + assistant messages).
 * @param provider - AI provider configuration.
 * @param options - Optional abort signal and error callback.
 * @returns The complete assistant response and provider info.
 */
export async function sendMessage(
  messages: ChatMessage[],
  provider: AIProvider,
  options?: SendMessageOptions,
): Promise<SendMessageResult> {
  try {
    const sdkProvider = createOpenAICompatible({
      name: provider.name,
      baseURL: provider.baseUrl,
      apiKey: provider.apiKey,
    });
    const model = sdkProvider.chatModel(provider.model);

    const coreMessages = messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    const result = streamText({
      model,
      messages: coreMessages,
      maxOutputTokens: provider.maxTokens,
      temperature: provider.temperature,
      abortSignal: options?.abortSignal,
      onError: ({ error }) => {
        options?.onError?.(
          error instanceof Error ? error : new Error(String(error)),
        );
      },
    });

    let content = "";
    for await (const chunk of result.textStream) {
      if (options?.abortSignal?.aborted) break;
      content += chunk;
      options?.onChunk?.(chunk, content);
    }

    return { content, provider };
  } catch (error) {
    throw toChatError(error);
  }
}

// ---------------------------------------------------------------------------
// useChatStreaming hook
// ---------------------------------------------------------------------------

/** Chat streaming status. */
export type ChatStreamingStatus = "idle" | "loading" | "streaming" | "error";

/** Return type for useChatStreaming. */
export interface ChatStreamingState {
  /** Current conversation messages. */
  messages: ChatMessage[];
  /** Text being streamed in real-time. */
  streamingText: string;
  /** Current status. */
  status: ChatStreamingStatus;
  /** Error message, if any. */
  error: string | null;
  /** Classified error code for type-aware UI. */
  errorCode: AIServiceErrorCode | null;
  /** Send a user message and stream the response. */
  sendChatMessage: (content: string) => Promise<void>;
  /** Abort the current streaming response. */
  stopStreaming: () => void;
  /** Reset the conversation. */
  clearMessages: () => void;
}

/**
 * React hook for managing streaming chat state.
 *
 * Manages:
 * - Message list (user + assistant messages)
 * - Real-time streaming text accumulation
 * - AbortController for cancellation
 * - Error handling with user-friendly messages
 *
 * @param initialMessages - Optional initial conversation messages.
 * @returns Chat streaming state and actions.
 */
export function useChatStreaming(
  initialMessages: ChatMessage[] = [],
): ChatStreamingState {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [streamingText, setStreamingText] = useState("");
  const [status, setStatus] = useState<ChatStreamingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AIServiceErrorCode | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingTextRef = useRef("");

  const config = useAIConfigStore((s) => s.config);

  // Abort on unmount
  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const sendChatMessage = useCallback(
    async (content: string) => {
      const provider = config.providers.find(
        (p) => p.id === config.selectedProviderId && p.enabled,
      );
      if (!provider) {
        setError("No AI provider configured");
        setErrorCode("AUTH_ERROR");
        setStatus("error");
        return;
      }

      // Create abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        createdAt: Date.now(),
      };

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      };

      const currentMessages = [...messages, userMessage, assistantMessage];
      setMessages(currentMessages);
      setStreamingText("");
      streamingTextRef.current = "";
      setError(null);
      setErrorCode(null);
      setStatus("loading");

      try {
        // Build messages for API (without the empty assistant placeholder)
        const apiMessages = currentMessages.slice(0, -1);

        const result = await sendMessage(apiMessages, provider, {
          abortSignal: abortController.signal,
          onChunk: (_chunk, accumulated) => {
            setStreamingText(accumulated);
            streamingTextRef.current = accumulated;
          },
          onError: (err) => setError(err.message),
        });

        // Update the assistant message with final content
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? { ...msg, content: result.content }
              : msg,
          ),
        );
        setStatus("idle");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Preserve partial streamed content as the assistant message
          const partial = streamingTextRef.current;
          if (partial) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: partial }
                  : msg,
              ),
            );
          }
          setStatus("idle");
          return;
        }

        const chatError = toChatError(err);
        setError(chatError.message);
        setErrorCode(chatError.code);
        setStatus("error");

        // Remove the empty assistant message on error
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantMessage.id),
        );
      }
    },
    [messages, config],
  );

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingText("");
    setError(null);
    setErrorCode(null);
    setStatus("idle");
  }, []);

  return {
    messages,
    streamingText,
    status,
    error,
    errorCode,
    sendChatMessage,
    stopStreaming,
    clearMessages,
  };
}
