/**
 * Book loading hook for ReaderPage.
 * Manages parsed book state (EPUB or PDF-as-ParsedEpub), loading state,
 * and error state. Handles book import, auto-load on mount, and reset on
 * book change.
 *
 * PDF books additionally expose the live pdf.js document handle
 * (`pdfDocument`) for canvas rendering in PdfViewer.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useBookStore, formatFromFilePath } from "@/stores/useBookStore";
import {
  importBook,
  EpubImportError,
  ImportErrorCode,
  readFileAsArrayBuffer,
} from "@/lib/import";
import { restoreNotes, restoreHighlights } from "@/lib/annotations";
import { restoreSummaries } from "@/lib/summaries";
import { restoreProgress, trackProgress, flushProgress } from "@/lib/progress";
import type { ParsedEpub } from "@/lib/epub";
import { loadEpub } from "@/lib/epub";
import { loadPdf, destroyPdfDocument } from "@/lib/pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { setParsedEpub as setRAGCache, clearParsedEpub as clearRAGCache } from "@/lib/rag";

/** Loaded book content: ParsedEpub view + optional live PDF handle. */
interface LoadedBook {
  parsed: ParsedEpub;
  pdfDocument: PDFDocumentProxy | null;
}

/** Resolve the effective format for a book (absent format → infer from path). */
function effectiveFormat(filePath: string, format?: "epub" | "pdf"): "epub" | "pdf" {
  return format ?? formatFromFilePath(filePath);
}

/** Read + parse a book file into the LoadedBook shape. */
async function parseBookFile(filePath: string, format: "epub" | "pdf"): Promise<LoadedBook> {
  const arrayBuffer = await readFileAsArrayBuffer(filePath);

  if (format === "pdf") {
    const pdfBook = await loadPdf(arrayBuffer, { extractContent: true, generateCover: false });
    return { parsed: pdfBook.parsed, pdfDocument: pdfBook.document };
  }

  const parsed = await loadEpub(arrayBuffer, { extractContent: true });
  return { parsed, pdfDocument: null };
}

/** Release a PDF document, swallowing errors (best-effort cleanup). */
function releasePdfDocument(doc: PDFDocumentProxy | null): void {
  if (doc) {
    destroyPdfDocument(doc).catch(() => undefined);
  }
}

export function useEpubLoader() {
  const currentBook = useBookStore((state) => state.currentBook);
  const setCurrentChapter = useBookStore((state) => state.setCurrentChapter);

  const [parsedEpub, setParsedEpub] = useState<ParsedEpub | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live handle to the currently-loaded PDF document (for cleanup on unmount).
  // A ref (not state) so effect cleanups don't destroy freshly loaded docs.
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);

  /** Install a new PDF document, releasing any previous one. */
  const installPdfDocument = useCallback((doc: PDFDocumentProxy | null) => {
    const prev = pdfDocRef.current;
    if (prev && prev !== doc) {
      releasePdfDocument(prev);
    }
    pdfDocRef.current = doc;
    setPdfDocument(doc);
  }, []);

  // Total chapters from parsed book (PDF pages count as chapters)
  const totalChapters = parsedEpub?.chapters.length ?? 0;

  // Effective format of the currently loaded book
  const format = currentBook
    ? effectiveFormat(currentBook.filePath, currentBook.format)
    : "epub";

  /**
   * Shared post-load setup: seed state, RAG cache, restore annotations,
   * and set the initial chapter.
   */
  const finalizeLoad = useCallback(
    async (loaded: LoadedBook, bookId: string, filePath: string) => {
      setParsedEpub(loaded.parsed);
      installPdfDocument(loaded.pdfDocument);
      setRAGCache(loaded.parsed);

      // Restore saved notes, highlights, summaries, and progress for this book
      try {
        await restoreNotes(bookId);
        await restoreHighlights(bookId);
        await restoreSummaries(bookId);
        await restoreProgress(bookId, filePath);
      } catch (restoreErr) {
        // Non-fatal: log but don't block import
        console.warn("Failed to restore annotations:", restoreErr);
      }

      // Set first chapter as current (restoreProgress may have set a different one)
      setCurrentChapter(loaded.parsed.chapters[0].href, 0);
    },
    [installPdfDocument, setCurrentChapter],
  );

  /**
   * Handle book import.
   * Opens file dialog, parses the book (EPUB or PDF), and loads chapters.
   * Provides user-friendly error messages for various failure scenarios.
   */
  const handleImport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { book, filePath } = await importBook();

      // Re-read and fully parse the book for chapter/page content
      let loaded: LoadedBook;
      try {
        loaded = await parseBookFile(filePath, effectiveFormat(book.filePath, book.format));
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
      if (loaded.parsed.chapters.length === 0) {
        throw new EpubImportError(
          ImportErrorCode.NoChapters,
          "The book file contains no readable chapters"
        );
      }

      await finalizeLoad(loaded, book.id, filePath);
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
        setError(err instanceof Error ? err.message : "Failed to import book");
      }
    } finally {
      setLoading(false);
    }
  }, [finalizeLoad]);

  // Auto-load book content when currentBook exists but parsedEpub is missing
  // (e.g., page refresh, navigation from bookshelf)
  useEffect(() => {
    if (!currentBook || parsedEpub) return;

    let cancelled = false;
    let cleanupTracking: (() => void) | null = null;

    async function loadBook() {
      setLoading(true);
      setError(null);

      try {
        const bookFormat = effectiveFormat(
          currentBook!.filePath,
          currentBook!.format,
        );
        const loaded = await parseBookFile(currentBook!.filePath, bookFormat);

        if (cancelled) {
          // Drop the PDF document if the component unmounted mid-load
          releasePdfDocument(loaded.pdfDocument);
          return;
        }

        if (loaded.parsed.chapters.length === 0) {
          setError("The book file contains no readable chapters");
          return;
        }

        setParsedEpub(loaded.parsed);
        installPdfDocument(loaded.pdfDocument);
        setRAGCache(loaded.parsed);

        // Restore saved notes, highlights, summaries, and progress
        try {
          await restoreNotes(currentBook!.id);
          await restoreHighlights(currentBook!.id);
          await restoreSummaries(currentBook!.id);
          await restoreProgress(currentBook!.id, currentBook!.filePath);
        } catch (restoreErr) {
          console.warn("Failed to restore annotations:", restoreErr);
        }

        // Start tracking progress (auto-save on scroll/chapter change)
        cleanupTracking = trackProgress(currentBook!.id, currentBook!.filePath);
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

    return () => {
      cancelled = true;
      // Flush any pending progress saves and stop tracking
      if (cleanupTracking) {
        flushProgress();
        cleanupTracking();
      }
      // NOTE: the PDF document is released via installPdfDocument/unmount,
      // not here — this cleanup also runs when parsedEpub becomes non-null.
    };
  }, [currentBook, parsedEpub, installPdfDocument]);

  // Release the pdf.js document when the reader unmounts
  useEffect(() => {
    return () => {
      releasePdfDocument(pdfDocRef.current);
      pdfDocRef.current = null;
    };
  }, []);

  // Reset parsed book when book changes (e.g., re-import)
  useEffect(() => {
    if (!currentBook) {
      setParsedEpub(null);
      installPdfDocument(null);
      clearRAGCache();
    }
  }, [currentBook, installPdfDocument]);

  return { parsedEpub, pdfDocument, format, loading, error, setError, totalChapters, handleImport };
}
