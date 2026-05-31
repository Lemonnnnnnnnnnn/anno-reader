/**
 * Translation hook for AITranslationPanel.
 *
 * Handles:
 * - Preview translation on mount
 * - Full translation execution
 * - Translation state (status, text, error, preview data)
 */

import { useState, useEffect, useCallback } from "react";
import { TranslationService } from "@/lib/ai/translation";
import { useAIConfigStore } from "@/stores/useAIConfigStore";
import type { PreviewData } from "@/lib/ai/service";

export type PanelStatus = "previewing" | "loading" | "success" | "error";

interface UseTranslationParams {
  selectedText: string;
  chapterText: string | null;
}

export function useTranslation({ selectedText, chapterText }: UseTranslationParams) {
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [translationText, setTranslationText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  const config = useAIConfigStore((s) => s.config);
  const service = new TranslationService();

  const preview = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const data = await service.previewTranslate(
        selectedText,
        "Chinese",
        config,
        chapterText,
      );
      setPreviewData(data);
      setStatus("previewing");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Preview failed";
      setError(message);
      setStatus("error");
    }
  }, [selectedText, chapterText, config]);

  useEffect(() => {
    preview();
  }, [preview]);

  const translate = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const response = await service.translate(
        selectedText,
        "Chinese",
        config,
        chapterText,
      );
      setTranslationText(response.translation);
      setStatus("success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Translation failed";
      setError(message);
      setStatus("error");
    }
  }, [selectedText, chapterText, config]);

  return {
    status,
    translationText,
    setTranslationText,
    error,
    setError,
    previewData,
    translate,
    preview,
  };
}
