/**
 * Translation hook for AITranslationPanel.
 *
 * Handles:
 * - Streaming translation execution with automatic retry
 * - Translation state (status, text, error)
 * - User-friendly Chinese error messages
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { translationService } from "@/lib/ai/translation";
import { AIErrorHandler } from "@/lib/ai/error-handler";
import { useAIConfigStore } from "@/stores/useAIConfigStore";

export type PanelStatus = "loading" | "streaming" | "success" | "error";

interface UseTranslationParams {
  selectedText: string;
  chapterText: string | null;
  offset?: number;
  /** The sentence containing the selection (from iframe DOM) */
  selectionSentence?: string;
}

const errorHandler = new AIErrorHandler();

export function useTranslation({ selectedText, chapterText, offset, selectionSentence }: UseTranslationParams) {
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [translationText, setTranslationText] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const config = useAIConfigStore((s) => s.config);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Abort on unmount
  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const translate = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setStreamingText("");

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Use withRetry for automatic retry on retryable errors (network, timeout, rate limit)
      const result = await errorHandler.withRetry(
        () => translationService.translateStream(
          selectedText,
          "Chinese",
          config,
          { abortSignal: abortController.signal, onError: (err) => setError(err.message) },
          chapterText ?? undefined,
          offset,
          selectionSentence,
        ),
        3, // max retries
        (attempt, retryError) => {
          // Show retry progress to user
          setError(`重试中... (${attempt}/3) - ${errorHandler.getUserMessage(retryError)}`);
        },
      );

      setStatus("streaming");
      let accumulated = "";

      for await (const chunk of result.textStream) {
        if (abortController.signal.aborted) break;
        accumulated += chunk;
        setStreamingText(accumulated);
      }

      setTranslationText(accumulated);
      setStatus("success");
      setError(null);

      // Cache the streaming result for future non-streaming calls
      translationService.cacheTranslation(
        selectedText,
        "Chinese",
        accumulated,
        result.provider,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatus("success");
      } else {
        // Use user-friendly Chinese error message
        const message = errorHandler.getUserMessage(err);
        setError(message);
        setStatus("error");
      }
    }
  }, [selectedText, chapterText, config, offset, selectionSentence]);

  // Auto-translate on mount
  useEffect(() => {
    translate();
  }, [translate]);

  const stopTranslation = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    status,
    translationText,
    streamingText,
    setTranslationText,
    error,
    setError,
    translate,
    stopTranslation,
  };
}
