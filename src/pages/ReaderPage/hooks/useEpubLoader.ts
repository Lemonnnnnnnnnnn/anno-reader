/**
 * EPUB loading hook for ReaderPage.
 * Manages parsed EPUB state, loading state, and error state.
 * Handles EPUB import, auto-load on mount, and reset on book change.
 */

import { useState, useEffect, useCallback } from "react";
import { useBookStore } from "@/stores/useBookStore";
import { importEpub, EpubImportError, ImportErrorCode, readFileAsArrayBuffer } from "@/lib/import";
import { restoreNotes, restoreHighlights } from "@/lib/annotations";
import type { ParsedEpub } from "@/lib/epub";
import { loadEpub } from "@/lib/epub";

export function useEpubLoader() {
  const currentBook = useBookStore((state) => state.currentBook);
  const setCurrentChapter = useBookStore((state) => state.setCurrentChapter);

  const [parsedEpub, setParsedEpub] = useState<ParsedEpub | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Total chapters from parsed EPUB
  const totalChapters = parsedEpub?.chapters.length ?? 0;

  /**
   * Handle EPUB file import.
   * Opens file dialog, parses the EPUB, and loads chapters.
   * Provides user-friendly error messages for various failure scenarios.
   */
  const handleImport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { book, filePath } = await importEpub();

      // Re-read and fully parse the EPUB for chapter content
      let parsed: ParsedEpub;
      try {
        const arrayBuffer = await readFileAsArrayBuffer(filePath);
        parsed = await loadEpub(arrayBuffer, { extractContent: true });
      } catch (parseErr) {
        // If we got this far, the file was valid for metadata but failed for content
        const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        throw new EpubImportError(
          ImportErrorCode.ParseError,
          `Failed to load book content: ${errMsg}`,
          parseErr
        );
      }

      // Check if we got any chapters
      if (parsed.chapters.length === 0) {
        throw new EpubImportError(
          ImportErrorCode.NoChapters,
          "The EPUB file contains no readable chapters"
        );
      }

      setParsedEpub(parsed);

      // Restore saved notes and highlights for this book
      try {
        await restoreNotes(book.id);
        await restoreHighlights(book.id);
      } catch (restoreErr) {
        // Non-fatal: log but don't block import
        console.warn("Failed to restore annotations:", restoreErr);
      }

      // Set first chapter as current
      setCurrentChapter(parsed.chapters[0].href, 0);
    } catch (err) {
      // User cancelled the dialog — not an error
      if (err instanceof EpubImportError && err.isCancellation) {
        setLoading(false);
        return;
      }

      // Use user-friendly message from EpubImportError
      if (err instanceof EpubImportError) {
        setError(err.userMessage);
      } else {
        setError(err instanceof Error ? err.message : "Failed to import EPUB");
      }
    } finally {
      setLoading(false);
    }
  }, [setCurrentChapter]);

  // Auto-load EPUB content when currentBook exists but parsedEpub is missing
  // (e.g., page refresh, navigation from bookshelf)
  useEffect(() => {
    if (!currentBook || parsedEpub) return;

    let cancelled = false;

    async function loadBook() {
      setLoading(true);
      setError(null);

      try {
        const arrayBuffer = await readFileAsArrayBuffer(currentBook!.filePath);
        const parsed = await loadEpub(arrayBuffer, { extractContent: true });

        if (cancelled) return;

        if (parsed.chapters.length === 0) {
          setError("The EPUB file contains no readable chapters");
          return;
        }

        setParsedEpub(parsed);

        // Restore saved notes and highlights
        try {
          await restoreNotes(currentBook!.id);
          await restoreHighlights(currentBook!.id);
        } catch (restoreErr) {
          console.warn("Failed to restore annotations:", restoreErr);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load book");
        }
      } finally {
        // Always reset loading, even if cancelled — prevents stuck loading state
        setLoading(false);
      }
    }

    loadBook();
    return () => { cancelled = true; };
  }, [currentBook, parsedEpub]);

  // Reset parsed EPUB when book changes (e.g., re-import)
  useEffect(() => {
    if (!currentBook) {
      setParsedEpub(null);
    }
  }, [currentBook]);

  return { parsedEpub, loading, error, setError, totalChapters, handleImport };
}
