/**
 * WebReaderPage component.
 *
 * Full-screen page for reading web content. Composes UrlInput and
 * WebPageRenderer into a complete web-reading experience. Uses the
 * useWebStore for state management and supports history navigation.
 */

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Globe, Loader2, Sun, Moon } from "lucide-react";
import { useWebStore } from "@/stores/useWebStore";
import { useBookStore } from "@/stores/useBookStore";
import { UrlInput } from "@/components/UrlInput";
import { WebPageRenderer } from "@/components/WebPageRenderer";
import { Button } from "@/components/primitives";
import type { ContentSource, ContentRef } from "@/lib/content/types";
import type { WebPage } from "@/lib/web/types";

export function WebReaderPage() {
  const navigate = useNavigate();

  const currentPage = useWebStore((s) => s.currentPage);
  const isLoading = useWebStore((s) => s.isLoading);
  const error = useWebStore((s) => s.error);
  const historyIndex = useWebStore((s) => s.historyIndex);
  const historyLength = useWebStore((s) => s.history.length);
  const loadWebPage = useWebStore((s) => s.loadWebPage);
  const goBack = useWebStore((s) => s.goBack);
  const goForward = useWebStore((s) => s.goForward);
  const clearError = useWebStore((s) => s.clearError);

  const theme = useBookStore((s) => s.ui.theme);
  const setTheme = useBookStore((s) => s.setTheme);

  const handleToggleTheme = useCallback(() => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  }, [theme, setTheme]);

  const handleFetchComplete = useCallback(
    (page: WebPage) => {
      loadWebPage(page.url);
    },
    [loadWebPage],
  );

  const handleLinkClick = useCallback(
    (href: string) => {
      loadWebPage(href);
    },
    [loadWebPage],
  );

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < historyLength - 1;

  // Build ContentSource and ContentRef from the current page
  const contentSource: ContentSource | null = currentPage
    ? {
        id: currentPage.url,
        title: currentPage.title,
        html: currentPage.html,
        plainText: currentPage.plainText,
        type: "web",
      }
    : null;

  const contentRef: ContentRef | null = currentPage
    ? {
        collectionId: "web",
        sourceId: currentPage.url,
      }
    : null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg dark:bg-bg-dark text-text dark:text-text-dark font-serif">
      {/* Header */}
      <header className="shrink-0 bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark relative z-10">
        <div className="flex items-center justify-between px-4 py-3 max-w-[1200px] mx-auto w-full">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="icon"
              onClick={() => navigate("/bookshelf")}
              title="Back to bookshelf"
            >
              <ArrowLeft size={16} />
            </Button>

            {currentPage ? (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Globe
                  size={14}
                  className="shrink-0 text-text-muted dark:text-text-muted-dark"
                />
                <h1 className="text-sm font-medium text-text dark:text-text-dark truncate m-0">
                  {currentPage.title}
                </h1>
              </div>
            ) : (
              <h1 className="text-sm font-medium text-text dark:text-text-dark m-0">
                Web Reader
              </h1>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {currentPage && (
              <>
                <Button
                  variant="icon"
                  onClick={goBack}
                  disabled={!canGoBack}
                  title="Go back"
                >
                  <ArrowLeft size={16} />
                </Button>
                <Button
                  variant="icon"
                  onClick={goForward}
                  disabled={!canGoForward}
                  title="Go forward"
                >
                  <ArrowRight size={16} />
                </Button>
              </>
            )}
            <Button
              variant="icon"
              onClick={handleToggleTheme}
              title="Toggle theme"
            >
              {theme === "light" ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden relative">
        {/* Error banner */}
        {error && (
          <div className="flex items-center justify-between p-2 px-4 bg-error-bg dark:bg-error-bg-dark border-b border-error-border dark:border-error-border gap-3">
            <span className="text-sm text-error dark:text-error flex-1">
              {error}
            </span>
            <div className="flex gap-2 shrink-0">
              {currentPage && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => loadWebPage(currentPage.url)}
                >
                  Retry
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={clearError}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2
              size={32}
              className="animate-spin text-text-muted dark:text-text-muted-dark"
            />
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
              Fetching page...
            </p>
          </div>
        )}

        {/* URL input (when no page loaded and not loading) */}
        {!isLoading && !currentPage && !error && (
          <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
            <div className="text-text-muted dark:text-text-muted-dark opacity-50">
              <Globe size={64} />
            </div>
            <h2 className="text-xl font-semibold text-text dark:text-text-dark tracking-tight m-0">
              Read any web page
            </h2>
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark max-w-[320px] m-0 text-center">
              Enter a URL to fetch and read web content in a clean, distraction-free view
            </p>
            <div className="w-full max-w-[480px]">
              <UrlInput onFetchComplete={handleFetchComplete} />
            </div>
          </div>
        )}

        {/* URL input bar + rendered web page (when a page is loaded or error occurred) */}
        {!isLoading && (currentPage || error) && (
          <div className="flex flex-col h-full">
            <div className="shrink-0 p-3 border-b border-border dark:border-border-dark">
              <div className="max-w-[800px] mx-auto">
                <UrlInput onFetchComplete={handleFetchComplete} />
              </div>
            </div>

            {contentSource && contentRef && (
              <div className="flex-1 overflow-hidden">
                <WebPageRenderer
                  contentSource={contentSource}
                  contentRef={contentRef}
                  onLinkClick={handleLinkClick}
                  canGoBack={canGoBack}
                  onLinkBack={goBack}
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
