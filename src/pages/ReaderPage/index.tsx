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

import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, List, StickyNote, Settings, Book } from "lucide-react";
import { useBookStore } from "@/stores/useBookStore";
import { ChapterRenderer } from "@/components/ChapterRenderer";
import { ChapterNavigation } from "@/components/ChapterNavigation";
import { TocDrawer } from "@/components/TocDrawer";
import { AnnotationDrawer } from "@/components/AnnotationDrawer";
import { DataDirSetup } from "@/components/DataDirSetup";
import { Button } from "@/components/primitives";
import { useRouteGuard, useConfig, useEpubLoader, useKeyboardNav, useVimScroll } from "./hooks";

export function ReaderPage() {
  const navigate = useNavigate();
  const currentBook = useBookStore((state) => state.currentBook);
  const ui = useBookStore((state) => state.ui);
  const setCurrentChapter = useBookStore((state) => state.setCurrentChapter);
  const setScrollPosition = useBookStore((state) => state.setScrollPosition);
  const setPendingScrollCfi = useBookStore((state) => state.setPendingScrollCfi);

  // Route guard: redirect to bookshelf if no book
  const guardedBook = useRouteGuard();

  // Config check for DataDirSetup
  const { configReady, handleConfigComplete } = useConfig();

  // EPUB loading and state management
  const { parsedEpub, loading, error, setError, totalChapters, handleImport } = useEpubLoader();

  // Keyboard navigation between chapters
  useKeyboardNav(parsedEpub);

  // Iframe ref for ChapterRenderer
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const setIframeEl = (el: HTMLIFrameElement | null) => {
    iframeRef.current = el;
  };

  // Vim-like smooth scrolling (j/k keys)
  useVimScroll(iframeRef);

  // Drawer state
  const [tocDrawerOpen, setTocDrawerOpen] = useState(false);
  const [annotationDrawerOpen, setAnnotationDrawerOpen] = useState(false);

  // Return null if no book (before redirect completes)
  if (!guardedBook) {
    return null;
  }

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
            <ArrowLeft size={16} />
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
                <>
                  <Button
                    variant="icon"
                    className="ml-2"
                    onClick={() => setTocDrawerOpen(true)}
                    title="Table of Contents"
                  >
                    <List size={16} />
                  </Button>
                  <Button
                    variant="icon"
                    className="ml-2"
                    onClick={() => setAnnotationDrawerOpen(true)}
                    title="Annotations"
                  >
                    <StickyNote size={16} />
                  </Button>
                  <Button
                    variant="icon"
                    className="ml-2"
                    onClick={() => navigate("/settings")}
                    title="Settings"
                  >
                    <Settings size={16} />
                  </Button>
                </>
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
              <Book size={64} />
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
              resources={parsedEpub.resources}
              opfFolder={parsedEpub.opfFolder}
              manifestHrefs={parsedEpub.manifestHrefs}
              showNav={false}
              onIframeRef={setIframeEl}
            />
          </div>
        )}
        </main>

      {/* Footer: Navigation controls */}
      <footer className="shrink-0 bg-surface border-t border-border relative z-10 reader-footer">
        <div className="flex items-center justify-end px-4 py-2 max-w-[1200px] mx-auto w-full min-h-[48px]">
          {parsedEpub && totalChapters > 0 && (
            <ChapterNavigation
              chapters={parsedEpub.chapters}
              variant="compact"
              showChapterInfo={true}
            />
          )}
        </div>
      </footer>

      {/* Drawers */}
      <TocDrawer
        open={tocDrawerOpen}
        onClose={() => setTocDrawerOpen(false)}
        toc={parsedEpub?.toc ?? []}
        currentChapterHref={ui.currentChapter}
        chapters={parsedEpub?.chapters ?? []}
        onNavigate={(href, index) => {
          setCurrentChapter(href, index);
          setScrollPosition(0);
        }}
      />
      <AnnotationDrawer
        open={annotationDrawerOpen}
        onClose={() => setAnnotationDrawerOpen(false)}
        chapters={parsedEpub?.chapters ?? []}
        onNavigate={(href, index, cfiRange) => {
          setCurrentChapter(href, index);
          if (cfiRange) {
            setPendingScrollCfi(cfiRange);
          } else {
            setScrollPosition(0);
          }
        }}
      />

    </div>
  );
}
