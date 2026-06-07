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

import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, List, StickyNote, Search, Settings, MessageSquare, Book, Sun, Moon } from "lucide-react";
import { useBookStore } from "@/stores/useBookStore";
import useTheme from "@/hooks/useTheme";
import { ChapterRenderer } from "@/components/ChapterRenderer";
import { ChapterNavigation } from "@/components/ChapterNavigation";
import { TocDrawer } from "@/components/TocDrawer";
import { AnnotationDrawer } from "@/components/AnnotationDrawer";
import { DictionaryDrawer } from "@/components/DictionaryDrawer";
import { ChatDrawer } from "@/components/ChatDrawer";
import { DataDirSetup } from "@/components/DataDirSetup";
import { Button } from "@/components/primitives";
import { useRouteGuard, useConfig, useEpubLoader, useKeyboardNav, useVimScroll } from "./hooks";
import { parseCfiOffsets, scrollToAnchor, scrollToCharOffset } from "@/components/VerticalScroller/hooks/useScrollTracking";
import { findChapterIndexByHref, resolveEpubHref } from "@/lib/linkNavigation";

interface LinkHistoryEntry {
  chapterHref: string;
  scrollY: number;
}

export function ReaderPage() {
  const navigate = useNavigate();
  const currentBook = useBookStore((state) => state.currentBook);
  const ui = useBookStore((state) => state.ui);
  const setCurrentChapter = useBookStore((state) => state.setCurrentChapter);
  const setScrollPosition = useBookStore((state) => state.setScrollPosition);
  const setPendingScrollCfi = useBookStore((state) => state.setPendingScrollCfi);
  const setPendingScrollAnchor = useBookStore((state) => state.setPendingScrollAnchor);
  const setPendingScrollY = useBookStore((state) => state.setPendingScrollY);
  const theme = useBookStore((s) => s.ui.theme);
  const setTheme = useBookStore((s) => s.setTheme);

  useTheme();

  const handleToggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

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
  const [dictionaryDrawerOpen, setDictionaryDrawerOpen] = useState(false);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [pendingChatMessage, setPendingChatMessage] = useState<string | undefined>(undefined);
  const [linkHistory, setLinkHistory] = useState<LinkHistoryEntry[]>([]);

  const getCurrentScrollY = useCallback(
    () => iframeRef.current?.contentWindow?.scrollY ?? 0,
    [],
  );

  const pushLinkHistory = useCallback((entry: LinkHistoryEntry) => {
    setLinkHistory((prev) => {
      const next = [...prev, entry];
      return next.length > 20 ? next.slice(-20) : next;
    });
  }, []);

  const handleInlineLinkClick = useCallback((href: string) => {
    if (!parsedEpub || !ui.currentChapter) return;

    const resolved = resolveEpubHref(href, ui.currentChapter);
    if (!resolved) return;

    const targetIndex = findChapterIndexByHref(parsedEpub.chapters, resolved.targetPath);
    if (targetIndex === -1) {
      console.warn(`[link-navigation] Chapter not found: ${resolved.targetPath}`);
      return;
    }

    const targetChapter = parsedEpub.chapters[targetIndex];
    const currentEntry = {
      chapterHref: ui.currentChapter,
      scrollY: getCurrentScrollY(),
    };
    const isSameChapter = targetChapter.href === ui.currentChapter;

    if (isSameChapter) {
      if (!resolved.fragment || !iframeRef.current) return;
      const didScroll = scrollToAnchor(iframeRef.current, resolved.fragment, "smooth");
      if (didScroll) {
        pushLinkHistory(currentEntry);
      }
      return;
    }

    setCurrentChapter(targetChapter.href, targetIndex);
    pushLinkHistory(currentEntry);
    if (resolved.fragment) {
      setPendingScrollAnchor(resolved.fragment);
    } else {
      setScrollPosition(0);
    }
  }, [
    getCurrentScrollY,
    parsedEpub,
    pushLinkHistory,
    setCurrentChapter,
    setPendingScrollAnchor,
    setScrollPosition,
    ui.currentChapter,
  ]);

  const handleLinkBack = useCallback(() => {
    setLinkHistory((prev) => {
      if (prev.length === 0) return prev;

      const entry = prev[prev.length - 1];
      const remaining = prev.slice(0, -1);
      const targetIndex = parsedEpub
        ? findChapterIndexByHref(parsedEpub.chapters, entry.chapterHref)
        : -1;

      if (targetIndex === -1 || !parsedEpub) {
        console.warn(`[link-navigation] Back target not found: ${entry.chapterHref}`);
        return remaining;
      }

      if (entry.chapterHref === ui.currentChapter) {
        iframeRef.current?.contentWindow?.scrollTo({
          top: entry.scrollY,
          behavior: "smooth",
        });
      } else {
        const targetChapter = parsedEpub.chapters[targetIndex];
        setCurrentChapter(targetChapter.href, targetIndex);
        setPendingScrollY(entry.scrollY);
      }

      return remaining;
    });
  }, [parsedEpub, setCurrentChapter, setPendingScrollY, ui.currentChapter]);

  // Handle "Ask AI" from text selection toolbar
  const handleAskAI = (selectedText: string) => {
    const truncated = selectedText.length > 500
      ? selectedText.slice(0, 500) + "..."
      : selectedText;
    setPendingChatMessage(`Please explain this passage: "${truncated}"`);
    setChatDrawerOpen(true);
    // Close other drawers
    setTocDrawerOpen(false);
    setAnnotationDrawerOpen(false);
    setDictionaryDrawerOpen(false);
  };

  // Return null if no book (before redirect completes)
  if (!guardedBook) {
    return null;
  }

  // Loading state while checking config
  if (configReady === null) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg dark:bg-bg-dark text-text dark:text-text-dark font-serif">
        <main className="flex-1 overflow-hidden relative">
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-8 h-8 border-2 border-border dark:border-border-dark border-t-accent dark:border-t-accent-dark rounded-full animate-spin" />
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Loading...</p>
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg dark:bg-bg-dark text-text dark:text-text-dark font-serif">
      {/* Header: Book metadata */}
      <header className="shrink-0 bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark relative z-10 reader-header">
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
                <h1 className="text-base font-semibold text-text dark:text-text-dark truncate reader-book-title">{currentBook.title}</h1>
                <p className="text-xs text-text-secondary dark:text-text-secondary-dark truncate">{currentBook.author}</p>
              </div>
              {parsedEpub && (
                <>
                  <Button
                    variant="icon"
                    className="ml-2"
                    onClick={() => {
                      setTocDrawerOpen(true);
                      setChatDrawerOpen(false);
                    }}
                    title="Table of Contents"
                  >
                    <List size={16} />
                  </Button>
                  <Button
                    variant="icon"
                    className="ml-2"
                    onClick={() => {
                      setAnnotationDrawerOpen(true);
                      setChatDrawerOpen(false);
                    }}
                    title="Annotations"
                  >
                    <StickyNote size={16} />
                  </Button>
                  <Button
                    variant="icon"
                    className="ml-2"
                    onClick={() => {
                      setDictionaryDrawerOpen(true);
                      setChatDrawerOpen(false);
                    }}
                    title="Dictionary"
                  >
                    <Search size={16} />
                  </Button>
                  <Button
                    variant="icon"
                    className="ml-2"
                    onClick={() => navigate("/settings")}
                    title="Settings"
                  >
                    <Settings size={16} />
                  </Button>
                  <Button
                    variant="icon"
                    className="ml-2"
                    onClick={() => {
                      setChatDrawerOpen(true);
                      setTocDrawerOpen(false);
                      setAnnotationDrawerOpen(false);
                      setDictionaryDrawerOpen(false);
                    }}
                    title="AI Chat"
                  >
                    <MessageSquare size={16} />
                  </Button>
                  <Button
                    variant="icon"
                    className="ml-2"
                    onClick={handleToggleTheme}
                    title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
                  >
                    {theme === "light" ? <Sun size={16} /> : <Moon size={16} />}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex flex-col gap-0.5 min-w-0">
                <h1 className="text-base font-semibold text-text dark:text-text-dark truncate">Anno Reader</h1>
                <p className="text-xs text-text-secondary dark:text-text-secondary-dark truncate">Import an EPUB to begin</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content area: Chapter rendering */}
      <main className="flex-1 overflow-hidden relative">
        {error && (
          <div className="flex items-center justify-between p-2 px-4 bg-error-bg dark:bg-error-bg-dark border-b border-error-border dark:border-error-border gap-3">
            <span className="text-sm text-error dark:text-error flex-1">{error}</span>
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
            <div className="w-8 h-8 border-2 border-border dark:border-border-dark border-t-accent dark:border-t-accent-dark rounded-full animate-spin" />
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Opening book...</p>
          </div>
        )}

        {!loading && !parsedEpub && !currentBook && (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
            <div className="text-text-muted dark:text-text-muted-dark opacity-50">
              <Book size={64} />
            </div>
            <h2 className="text-xl font-semibold text-text dark:text-text-dark tracking-tight reader-empty-title">No book open</h2>
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark max-w-[280px] reader-empty-subtitle">
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
              onAskAI={handleAskAI}
              onLinkClick={handleInlineLinkClick}
              canGoBack={linkHistory.length > 0}
              onLinkBack={handleLinkBack}
            />
          </div>
        )}
        </main>

      {/* Footer: Navigation controls */}
      <footer className="shrink-0 bg-surface dark:bg-surface-dark border-t border-border dark:border-border-dark relative z-10 reader-footer">
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
          const isSameChapter = ui.currentChapter === href;
          
          if (isSameChapter && cfiRange && iframeRef.current) {
            // Same chapter: scroll directly to the annotation
            const offsets = parseCfiOffsets(cfiRange);
            if (offsets) {
              const midOffset = Math.floor((offsets.start + offsets.end) / 2);
              scrollToCharOffset(iframeRef.current, midOffset, "smooth");
            }
          } else {
            // Different chapter: navigate and set pending scroll
            setCurrentChapter(href, index);
            if (cfiRange) {
              setPendingScrollCfi(cfiRange);
            } else {
              setScrollPosition(0);
            }
          }
        }}
      />
      <DictionaryDrawer
        open={dictionaryDrawerOpen}
        onClose={() => setDictionaryDrawerOpen(false)}
      />
      <ChatDrawer
        isOpen={chatDrawerOpen}
        onClose={() => {
          setChatDrawerOpen(false);
          setPendingChatMessage(undefined);
        }}
        bookId={currentBook?.id}
        initialMessage={pendingChatMessage}
      />

    </div>
  );
}
