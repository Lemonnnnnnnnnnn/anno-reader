/**
 * Translation hook for AITranslationPanel.
 *
 * Handles:
 * - Streaming translation execution
 * - Translation state (status, text, error)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { translationService } from "@/lib/ai/translation";
import { useAIConfigStore } from "@/stores/useAIConfigStore";

export type PanelStatus = "loading" | "streaming" | "success" | "error";

interface UseTranslationParams {
  selectedText: string;
  chapterText: string | null;
  offset?: number;
  /** The sentence containing the selection (from iframe DOM) */
  selectionSentence?: string;
  /** The paragraph containing the selection (from iframe DOM) */
  selectionParagraph?: string;
}

export function useTranslation({ selectedText, chapterText, offset, selectionSentence, selectionParagraph }: UseTranslationParams) {
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
      const result = await translationService.translateStream(
        selectedText,
        "Chinese",
        config,
        { abortSignal: abortController.signal, onError: (err) => setError(err.message) },
        chapterText ?? undefined,
        offset,
        selectionSentence,
        selectionParagraph,
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
        const message =
          err instanceof Error ? err.message : "Translation failed";
        setError(message);
        setStatus("error");
      }
    }
  }, [selectedText, chapterText, config, offset, selectionSentence, selectionParagraph]);

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
