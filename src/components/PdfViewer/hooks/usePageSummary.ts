/**
 * usePageSummary hook.
 *
 * React state version of the streaming chapter summary used by the EPUB
 * iframe (VerticalScroller.runSummary). Streams the AI summary for the
 * current PDF page and persists it via the summaries module.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useBookStore } from "@/stores/useBookStore";
import {
  createSummary,
  updateSummary,
  generateSummaryStream,
} from "@/lib/summaries";

type SummaryStatus = "idle" | "streaming" | "error";

interface UsePageSummaryParams {
  chapterHref: string;
  chapterIndex: number;
  chapterTitle: string | null;
  chapterText: string | null;
}

export function usePageSummary({
  chapterHref,
  chapterIndex,
  chapterTitle,
  chapterText,
}: UsePageSummaryParams) {
  const [status, setStatus] = useState<SummaryStatus>("idle");
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const currentBook = useBookStore((state) => state.currentBook);
  // Existing persisted summary for this chapter (page)
  const existingSummary = useBookStore((state) =>
    state.summaries.find(
      (s) =>
        s.chapterHref === chapterHref &&
        (!state.currentBook || s.bookId === state.currentBook.id),
    ) ?? null,
  );

  // Reset transient state on page change; cancel any in-flight stream
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setContent("");
    setError(null);
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [chapterHref]);

  const run = useCallback(async () => {
    const book = currentBook;
    if (!book) return;

    if (!chapterText || chapterText.trim().length === 0) {
      setStatus("error");
      setError("本章没有可总结的文本内容。");
      return;
    }

    // Cancel any previous stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("streaming");
    setContent("");
    setError(null);

    try {
      const fullText = await generateSummaryStream({
        chapterText,
        chapterTitle,
        abortSignal: controller.signal,
        onChunk: (accumulated) => {
          setContent(accumulated);
        },
      });

      if (existingSummary) {
        await updateSummary(existingSummary.id, fullText, book.id);
      } else {
        await createSummary(book.id, chapterHref, chapterIndex, chapterTitle, fullText);
      }

      setStatus("idle");
      setContent(fullText);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus("error");
      setError(err instanceof Error ? err.message : "生成总结失败");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [currentBook, chapterText, chapterTitle, chapterHref, chapterIndex, existingSummary]);

  const dismiss = useCallback(() => {
    setStatus("idle");
    setContent("");
    setError(null);
  }, []);

  // Effective display state: persisted summary when idle-without-stream
  const savedContent = existingSummary?.content ?? "";
  const visibleContent = status === "streaming" || content ? content : savedContent;
  const hasSummary = status !== "error" && visibleContent.length > 0;

  return {
    status,
    content: visibleContent,
    hasSummary,
    error,
    run,
    dismiss,
  };
}
