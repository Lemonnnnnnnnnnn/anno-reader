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
import { runTranslationStream } from "@/lib/ai/translation-runner";
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
      // Retries (including stream-consumption failures) live in the shared
      // runner so the background quick-translate path behaves identically.
      const { translation } = await runTranslationStream({
        text: selectedText,
        targetLanguage: "Chinese",
        config,
        chapterText,
        offset,
        selectionSentence,
        abortSignal: abortController.signal,
        onStreamStart: () => setStatus("streaming"),
        onChunk: setStreamingText,
        onStreamError: (err) => setError(err.message),
        onRetry: (attempt, retryError) => {
          // Show retry progress to user
          setStatus("loading");
          setError(`重试中... (${attempt}/3) - ${errorHandler.getUserMessage(retryError)}`);
        },
      });

      setTranslationText(translation);
      setStatus("success");
      setError(null);
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

  // Re-translate from scratch: drop any cached result, then run the normal flow.
  // Used by the panel's Retry button so the same text can be re-translated
  // even when a prior result was cached.
  const retryTranslation = useCallback(() => {
    translationService.invalidateTranslation(selectedText, "Chinese");
    void translate();
  }, [selectedText, translate]);

  return {
    status,
    translationText,
    streamingText,
    setTranslationText,
    error,
    setError,
    translate,
    retryTranslation,
    stopTranslation,
  };
}
