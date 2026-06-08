/**
 * React hook for RAG-augmented book conversations.
 *
 * Manages indexing state and provides an askQuestion function
 * that wires into the RAG orchestrator pipeline.
 */

import { useState, useCallback, useEffect } from "react";
import { useBookStore } from "@/stores/useBookStore";
import { askQuestion, indexBookFromCache } from "./orchestrator";
import { bookIndexExists } from "./indexer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Return type for useRAG. */
export interface UseRAGReturn {
  /** Whether the book is currently being indexed. */
  isIndexing: boolean;
  /** Whether the book has been indexed (in this session). */
  isIndexed: boolean;
  /** Error message if indexing or search failed. */
  error: string | null;
  /**
   * Ask a question about the current book.
   * Automatically indexes the book on first query.
   *
   * @param query - The user's question.
   * @returns System message with book context, or null if no book is loaded.
   */
  askQuestion: (query: string) => Promise<{ systemMessage: string } | null>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook for RAG-based book conversations.
 *
 * Provides:
 * - `isIndexing` — true while the book is being indexed
 * - `isIndexed` — true after successful indexing (resets on book change)
 * - `error` — error message from indexing or search failures
 * - `askQuestion(query)` — runs the full RAG pipeline and returns a system message
 *
 * The hook reads the current book from useBookStore and uses the
 * parsed EPUB cache for indexing. Indexing happens lazily on the
 * first call to askQuestion.
 *
 * @example
 * ```tsx
 * const { askQuestion, isIndexing, error } = useRAG();
 *
 * const handleSend = async (content: string) => {
 *   const result = await askQuestion(content);
 *   if (result) {
 *     await sendChatMessage(content, result.systemMessage);
 *   }
 * };
 * ```
 */
export function useRAG(): UseRAGReturn {
  const [isIndexing, setIsIndexing] = useState(false);
  const [isIndexed, setIsIndexed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentBook = useBookStore((s) => s.currentBook);

  // Check backend index state on mount and when book changes
  useEffect(() => {
    if (!currentBook) {
      setIsIndexed(false);
      return;
    }

    let cancelled = false;

    async function checkIndex() {
      try {
        const exists = await bookIndexExists(currentBook!.id);
        if (!cancelled) {
          setIsIndexed(exists);
        }
      } catch (err) {
        // If check fails, assume not indexed (will re-index on first query)
        if (!cancelled) {
          setIsIndexed(false);
        }
      }
    }

    checkIndex();

    return () => {
      cancelled = true;
    };
  }, [currentBook]);

  const handleAskQuestion = useCallback(
    async (query: string): Promise<{ systemMessage: string } | null> => {
      if (!currentBook) {
        return null;
      }

      setError(null);

      try {
        // Index on first query if not yet indexed
        if (!isIndexed) {
          setIsIndexing(true);
          try {
            await indexBookFromCache(currentBook.id);
            setIsIndexed(true);
          } finally {
            setIsIndexing(false);
          }
        }

        // Search + assemble context
        const result = await askQuestion(
          currentBook.id,
          query,
          currentBook.title,
          currentBook.author,
        );

        return { systemMessage: result.systemMessage };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "RAG pipeline failed";
        setError(message);
        return null;
      }
    },
    [currentBook, isIndexed],
  );

  return {
    isIndexing,
    isIndexed,
    error,
    askQuestion: handleAskQuestion,
  };
}
