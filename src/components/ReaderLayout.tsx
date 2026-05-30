/**
 * ReaderLayout component.
 *
 * Main application layout for the EPUB reader. Provides a three-section
 * structure: header (book metadata), content area (chapter rendering),
 * and footer (navigation + import controls).
 *
 * Integrates with the Zustand store for book state, the import module
 * for file selection, and ChapterRenderer for content display.
 *
 * @example
 * ```tsx
 * <ReaderLayout />
 * ```
 */

import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBookStore } from "@/stores/useBookStore";
import { importEpub, EpubImportError, ImportErrorCode } from "@/lib/import";
import { restoreNotes, restoreHighlights } from "@/lib/annotations";
import { ChapterRenderer } from "./ChapterRenderer";
import { ChapterNavigation } from "./ChapterNavigation";
import { AnnotationPanel } from "./AnnotationPanel";
import { DataDirSetup } from "./DataDirSetup";
import type { ParsedEpub } from "@/lib/epub";
import { loadEpub } from "@/lib/epub";
import { readFileAsArrayBuffer } from "@/lib/import";
import { readConfig, isDataDirValid } from "@/lib/storage/config";

export function ReaderLayout() {
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
      <div style={styles.layout}>
        <main style={styles.content}>
          <div style={styles.loadingState}>
            <div style={styles.loadingSpinner} />
            <p style={styles.loadingText}>Loading...</p>
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
    <div style={styles.layout}>
      {/* Header: Book metadata */}
      <header style={styles.header} className="reader-header">
        <div style={styles.headerContent}>
          <button
            style={styles.backButton}
            onClick={() => navigate("/bookshelf")}
            title="Back to bookshelf"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          {currentBook ? (
            <div style={styles.bookInfo}>
              {currentBook.coverUrl && (
                <img
                  src={currentBook.coverUrl}
                  alt=""
                  style={styles.headerCover}
                  className="reader-header-cover"
                />
              )}
              <div style={styles.bookText}>
                <h1 style={styles.title} className="reader-book-title">{currentBook.title}</h1>
                <p style={styles.author}>{currentBook.author}</p>
              </div>
              {parsedEpub && (
                <button
                  style={styles.annotationButton}
                  onClick={() => setAnnotationPanelOpen(!annotationPanelOpen)}
                  title="View annotations"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <div style={styles.bookInfo}>
              <div style={styles.bookText}>
                <h1 style={styles.title}>Anno Reader</h1>
                <p style={styles.author}>Import an EPUB to begin</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content area: Chapter rendering */}
      <main style={styles.content}>
        {error && (
          <div style={styles.errorBanner}>
            <span style={styles.errorText}>{error}</span>
            <div style={styles.errorActions}>
              <button
                style={styles.errorRetry}
                onClick={handleImport}
              >
                Retry
              </button>
              <button
                style={styles.errorDismiss}
                onClick={() => setError(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div style={styles.loadingState}>
            <div style={styles.loadingSpinner} />
            <p style={styles.loadingText}>Opening book...</p>
          </div>
        )}

        {!loading && !parsedEpub && !currentBook && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
            <h2 style={styles.emptyTitle} className="reader-empty-title">No book open</h2>
            <p style={styles.emptySubtitle} className="reader-empty-subtitle">
              Import an EPUB file to start reading
            </p>
            <button style={styles.importButton} onClick={handleImport}>
              Import EPUB
            </button>
          </div>
        )}

        {!loading && parsedEpub && (
          <div style={styles.readerArea}>
            <ChapterRenderer
              chapters={parsedEpub.chapters}
              showNav={false}
            />
          </div>
        )}
      </main>

      {/* Footer: Navigation controls */}
      <footer style={styles.footer} className="reader-footer">
        <div style={styles.footerContent}>
          <button
            style={styles.footerButton}
            onClick={handleImport}
            disabled={loading}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={styles.buttonIcon}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Import
          </button>

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

// --- Design tokens (aligned with project conventions) ---

const colors = {
  bg: "#f6f6f6",
  surface: "#ffffff",
  text: "#0f0f0f",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  border: "#e5e5e5",
  borderLight: "#f0f0f0",
  accent: "#374151",
  accentHover: "#1f2937",
  error: "#dc2626",
  errorBg: "#fef2f2",
  errorBorder: "#fecaca",
} as const;

const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  xxl: "2rem",
} as const;

const styles: Record<string, React.CSSProperties> = {
  // --- Layout shell ---
  layout: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
    background: colors.bg,
    color: colors.text,
    fontFamily:
      "'Literata', 'Georgia', 'Iowan Old Style', 'Palatino Linotype', 'Noto Serif', 'Noto Serif CJK SC', serif",
    fontOpticalSizing: "auto",
    fontFeatureSettings: "'kern' 1, 'liga' 1",
  },

  // --- Header ---
  header: {
    flexShrink: 0,
    background: colors.surface,
    borderBottom: `1px solid ${colors.border}`,
    position: "relative",
    zIndex: 10,
  },
  headerContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${spacing.md} ${spacing.xl}`,
    maxWidth: "1200px",
    margin: "0 auto",
    width: "100%",
  },
  bookInfo: {
    display: "flex",
    alignItems: "center",
    gap: spacing.md,
    minWidth: 0,
    flex: 1,
  },
  headerCover: {
    width: "36px",
    height: "48px",
    objectFit: "cover",
    borderRadius: "2px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
    flexShrink: 0,
  },
  bookText: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 600,
    lineHeight: 1.3,
    color: colors.text,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    letterSpacing: "-0.01em",
    textAlign: "left",
  },
  author: {
    margin: 0,
    fontSize: "0.8rem",
    color: colors.textSecondary,
    fontWeight: 400,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    letterSpacing: "0.01em",
  },
  backButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    background: "transparent",
    border: `1px solid ${colors.border}`,
    borderRadius: "6px",
    cursor: "pointer",
    color: colors.textSecondary,
    transition: "color 0.15s, border-color 0.15s",
    flexShrink: 0,
    marginRight: spacing.sm,
    padding: 0,
  },
  annotationButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    background: "transparent",
    border: `1px solid ${colors.border}`,
    borderRadius: "6px",
    cursor: "pointer",
    color: colors.textSecondary,
    transition: "color 0.15s, border-color 0.15s",
    flexShrink: 0,
    marginLeft: spacing.sm,
    padding: 0,
  },

  // --- Content area ---
  content: {
    flex: 1,
    overflow: "hidden",
    position: "relative",
  },
  readerArea: {
    height: "100%",
    overflow: "hidden",
  },

  // --- Loading state ---
  loadingState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: spacing.lg,
  },
  loadingSpinner: {
    width: "32px",
    height: "32px",
    border: `2px solid ${colors.border}`,
    borderTopColor: colors.accent,
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    margin: 0,
    fontSize: "0.9rem",
    color: colors.textSecondary,
  },

  // --- Empty state ---
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: spacing.lg,
    padding: spacing.xxl,
    textAlign: "center",
  },
  emptyIcon: {
    color: colors.textMuted,
    opacity: 0.5,
  },
  emptyTitle: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 600,
    color: colors.text,
    letterSpacing: "-0.02em",
  },
  emptySubtitle: {
    margin: 0,
    fontSize: "0.9rem",
    color: colors.textSecondary,
    maxWidth: "280px",
  },
  importButton: {
    marginTop: spacing.sm,
    padding: `${spacing.md} ${spacing.xl}`,
    fontSize: "0.875rem",
    fontWeight: 500,
    color: colors.surface,
    background: colors.accent,
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "background 0.15s, transform 0.1s",
    letterSpacing: "0.01em",
    boxShadow: "none",
    fontFamily: "inherit",
  },

  // --- Error banner ---
  errorBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${spacing.sm} ${spacing.lg}`,
    background: colors.errorBg,
    borderBottom: `1px solid ${colors.errorBorder}`,
    gap: spacing.md,
  },
  errorText: {
    fontSize: "0.85rem",
    color: colors.error,
    flex: 1,
  },
  errorActions: {
    display: "flex",
    gap: spacing.sm,
    flexShrink: 0,
  },
  errorRetry: {
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: "0.8rem",
    color: colors.surface,
    background: colors.error,
    border: `1px solid ${colors.error}`,
    borderRadius: "4px",
    cursor: "pointer",
    flexShrink: 0,
    boxShadow: "none",
    fontFamily: "inherit",
  },
  errorDismiss: {
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: "0.8rem",
    color: colors.error,
    background: "transparent",
    border: `1px solid ${colors.errorBorder}`,
    borderRadius: "4px",
    cursor: "pointer",
    flexShrink: 0,
    boxShadow: "none",
    fontFamily: "inherit",
  },

  // --- Footer ---
  footer: {
    flexShrink: 0,
    background: colors.surface,
    borderTop: `1px solid ${colors.border}`,
    position: "relative",
    zIndex: 10,
  },
  footerContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${spacing.sm} ${spacing.xl}`,
    maxWidth: "1200px",
    margin: "0 auto",
    width: "100%",
    minHeight: "48px",
  },
  footerButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: spacing.sm,
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: "0.8rem",
    fontWeight: 500,
    color: colors.textSecondary,
    background: "transparent",
    border: `1px solid ${colors.border}`,
    borderRadius: "6px",
    cursor: "pointer",
    transition: "color 0.15s, border-color 0.15s",
    letterSpacing: "0.01em",
    boxShadow: "none",
    fontFamily: "inherit",
  },
  buttonIcon: {
    flexShrink: 0,
    verticalAlign: "middle",
  },
};
