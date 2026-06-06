/**
 * Translation hook for AITranslationPanel.
 *
 * Handles:
 * - Preview translation on mount
 * - Full translation execution
 * - Translation state (status, text, error, preview data)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { TranslationService } from "@/lib/ai/translation";
import { useAIConfigStore } from "@/stores/useAIConfigStore";
import type { PreviewData } from "@/lib/ai/service";

export type PanelStatus = "previewing" | "loading" | "streaming" | "success" | "error";

interface UseTranslationParams {
  selectedText: string;
  chapterText: string | null;
  skipPreview?: boolean;
  offset?: number;
  /** The sentence containing the selection (from iframe DOM) */
  selectionSentence?: string;
  /** The paragraph containing the selection (from iframe DOM) */
  selectionParagraph?: string;
}

export function useTranslation({ selectedText, chapterText, skipPreview = false, offset, selectionSentence, selectionParagraph }: UseTranslationParams) {
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [translationText, setTranslationText] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  const config = useAIConfigStore((s) => s.config);
  const serviceRef = useRef<TranslationService>(null);
  if (!serviceRef.current) {
    serviceRef.current = new TranslationService();
  }
  const service = serviceRef.current;

  const abortControllerRef = useRef<AbortController | null>(null);

  // Abort on unmount
  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const preview = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const data = await service.previewTranslate(
        selectedText,
        "Chinese",
        config,
        chapterText,
        offset,
        selectionSentence,
        selectionParagraph,
      );
      setPreviewData(data);
      setStatus("previewing");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Preview failed";
      setError(message);
      setStatus("error");
    }
  }, [selectedText, chapterText, config, offset, selectionSentence, selectionParagraph]);

  const translate = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setStreamingText("");

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const result = await service.translateStream(
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
      service.cacheTranslation(
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

  useEffect(() => {
    if (skipPreview) {
      translate();
    } else {
      preview();
    }
  }, [skipPreview, preview, translate]);

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
    previewData,
    translate,
    stopTranslation,
    preview,
  };
}
