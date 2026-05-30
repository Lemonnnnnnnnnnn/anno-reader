/**
 * ReaderPage component.
 *
 * Main application page for the EPUB reader. Provides a three-section
 * structure: header (book metadata), content area (chapter rendering),
 * and footer (navigation + import controls).
 *
 * Includes route guard: redirects to /bookshelf if no book is loaded.
 *
 * Integrates with the Zustand store for book state, the import module
 * for file selection, and ChapterRenderer for content display.
 */

import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBookStore } from "@/stores/useBookStore";
import { importEpub, EpubImportError, ImportErrorCode } from "@/lib/import";
import { restoreNotes, restoreHighlights } from "@/lib/annotations";
import { ChapterRenderer } from "@/components/ChapterRenderer";
import { ChapterNavigation } from "@/components/ChapterNavigation";
import { AnnotationPanel } from "@/components/AnnotationPanel";
import { DataDirSetup } from "@/components/DataDirSetup";
import { Button, Icon } from "@/components/primitives";
import type { ParsedEpub } from "@/lib/epub";
import { loadEpub } from "@/lib/epub";
import { readFileAsArrayBuffer } from "@/lib/import";
import { readConfig, isDataDirValid } from "@/lib/storage/config";

export function ReaderPage() {
  const navigate = useNavigate();
  const currentBook = useBookStore((state) => state.currentBook);
  const ui = useBookStore((state) => state.ui);
  const setCurrentChapter = useBookStore((state) => state.setCurrentChapter);

  const [parsedEpub, setParsedEpub] = useState<ParsedEpub | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [annotationPanelOpen, setAnnotationPanelOpen] = useState(false);
  const [configReady, setConfigReady] = useState<boolean | null>(null);

  // Total chapters from parsed EPUB
  const totalChapters = parsedEpub?.chapters.length ?? 0;

  // Redirect to bookshelf if no book is loaded
  useEffect(() => {
    if (!currentBook) {
      navigate("/bookshelf", { replace: true });
    }
  }, [currentBook, navigate]);

  // Return null if no book (before redirect completes)
  if (!currentBook) {
    return null;
  }

  // Check config on mount to determine if DataDirSetup is needed
  useEffect(() => {
    let cancelled = false;

    async function checkConfig() {
      try {
        const config = await readConfig();
        if (cancelled) return;

        if (!config) {
          setConfigReady(false);
          return;
        }

        const valid = await isDataDirValid(config.dataDir);
        if (cancelled) return;

        setConfigReady(valid);
      } catch {
        if (!cancelled) setConfigReady(false);
      }
    }

    checkConfig();
    return () => { cancelled = true; };
  }, []);

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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!parsedEpub || parsedEpub.chapters.length === 0) return;

      const totalChapters = parsedEpub.chapters.length;

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (ui.currentChapterIndex > 0) {
          const newIndex = ui.currentChapterIndex - 1;
          const chapter = parsedEpub.chapters[newIndex];
          if (chapter) {
            setCurrentChapter(chapter.href, newIndex);
          }
        }
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        if (ui.currentChapterIndex < totalChapters - 1) {
          const newIndex = ui.currentChapterIndex + 1;
          const chapter = parsedEpub.chapters[newIndex];
          if (chapter) {
            setCurrentChapter(chapter.href, newIndex);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ui.currentChapterIndex, parsedEpub, setCurrentChapter]);

  // Called when DataDirSetup completes — verify config then transition
  const handleConfigComplete = useCallback(async () => {
    try {
      const config = await readConfig();
      if (config && (await isDataDirValid(config.dataDir))) {
        setConfigReady(true);
      } else {
        setConfigReady(false);
      }
    } catch {
      setConfigReady(false);
    }
  }, []);

  // Loading state while checking config
  if (configReady === null) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg text-text font-serif">
        <main className="flex-1 overflow-hidden relative">
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
            <p className="text-sm text-text-secondary">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  // First launch — show DataDirSetup
  if (!configReady) {
    return <DataDirSetup onComplete={handleConfigComplete} />;
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg text-text font-serif">
      {/* Header: Book metadata */}
      <header className="shrink-0 bg-surface border-b border-border relative z-10 reader-header">
        <div className="flex items-center justify-between px-4 py-3 max-w-[1200px] mx-auto w-full">
          <Button
            variant="icon"
            className="mr-2"
            onClick={() => navigate("/bookshelf")}
            title="Back to bookshelf"
          >
            <Icon name="arrow-left" size={16} />
          </Button>
          {currentBook ? (
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {currentBook.coverUrl && (
                <img
                  src={currentBook.coverUrl}
                  alt=""
                  className="w-9 h-12 object-cover rounded shadow-sm shrink-0 reader-header-cover"
                />
              )}
              <div className="flex flex-col gap-0.5 min-w-0">
                <h1 className="text-base font-semibold text-text truncate reader-book-title">{currentBook.title}</h1>
                <p className="text-xs text-text-secondary truncate">{currentBook.author}</p>
              </div>
              {parsedEpub && (
                <Button
                  variant="icon"
                  className="ml-2"
                  onClick={() => setAnnotationPanelOpen(!annotationPanelOpen)}
                  title="View annotations"
                >
                  <Icon name="edit" size={16} />
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex flex-col gap-0.5 min-w-0">
                <h1 className="text-base font-semibold text-text truncate">Anno Reader</h1>
                <p className="text-xs text-text-secondary truncate">Import an EPUB to begin</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content area: Chapter rendering */}
      <main className="flex-1 overflow-hidden relative">
        {error && (
          <div className="flex items-center justify-between p-2 px-4 bg-error-bg border-b border-error-border gap-3">
            <span className="text-sm text-error flex-1">{error}</span>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="primary"
                size="sm"
                onClick={handleImport}
              >
                Retry
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
            <p className="text-sm text-text-secondary">Opening book...</p>
          </div>
        )}

        {!loading && !parsedEpub && !currentBook && (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
            <div className="text-text-muted opacity-50">
              <Icon name="book" size={64} />
            </div>
            <h2 className="text-xl font-semibold text-text tracking-tight reader-empty-title">No book open</h2>
            <p className="text-sm text-text-secondary max-w-[280px] reader-empty-subtitle">
              Import an EPUB file to start reading
            </p>
            <Button variant="primary" onClick={handleImport}>
              Import EPUB
            </Button>
          </div>
        )}

        {!loading && parsedEpub && (
          <div className="h-full overflow-hidden">
            <ChapterRenderer
              chapters={parsedEpub.chapters}
              showNav={false}
            />
          </div>
        )}
      </main>

      {/* Footer: Navigation controls */}
      <footer className="shrink-0 bg-surface border-t border-border relative z-10 reader-footer">
        <div className="flex items-center justify-between px-4 py-2 max-w-[1200px] mx-auto w-full min-h-[48px]">
          <Button
            variant="secondary"
            onClick={handleImport}
            disabled={loading}
          >
            <Icon name="download" size={16} className="shrink-0" />
            Import
          </Button>

          {parsedEpub && totalChapters > 0 && (
            <ChapterNavigation
              chapters={parsedEpub.chapters}
              variant="compact"
              showChapterInfo={true}
            />
          )}
        </div>
      </footer>

      {/* Annotation panel overlay */}
      <AnnotationPanel
        open={annotationPanelOpen}
        onClose={() => setAnnotationPanelOpen(false)}
      />
    </div>
  );
}
