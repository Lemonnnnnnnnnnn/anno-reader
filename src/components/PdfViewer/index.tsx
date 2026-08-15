/**
 * PdfViewer component.
 *
 * Renders PDF pages with pdf.js: canvas painting + transparent text
 * layer for text selection + an annotation-derived LINK layer for
 * embedded hyperlinks (citations [32] → bibliography, TOC entries,
 * external URLs). Page navigation is driven by the shared chapter state
 * (ui.currentChapterIndex) — each PDF page is a "chapter" — so
 * ChapterNavigation, keyboard nav, TOC, and progress tracking work
 * unchanged.
 *
 * Selection and annotation UX reuse the shared ReaderOverlays via the
 * window postMessage contract (see ReaderOverlays/index.tsx).
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, Maximize, ArrowLeft } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useBookStore } from "@/stores/useBookStore";
import { ReaderOverlays } from "../ReaderOverlays";
import { usePdfPage } from "./hooks/usePdfPage";
import { usePdfAnnotations } from "./hooks/usePdfAnnotations";
import { usePdfSelection } from "./hooks/usePdfSelection";
import { usePdfLinks } from "./hooks/usePdfLinks";
import { usePageSummary } from "./hooks/usePageSummary";
import { PageSummaryCard } from "./PageSummaryCard";
import { extractPlainText } from "../ChapterRenderer";
import type { EpubChapterInfo } from "@/lib/epub/types";
import type { PdfLink } from "@/lib/pdf/links";
import { parseCfiOffsets, wrapRange } from "./textLayerDom";

interface PdfViewerProps {
  /** Live pdf.js document handle. */
  document: PDFDocumentProxy;
  /** Parsed book view (pages as chapters). */
  chapters: EpubChapterInfo[];
  /** Callback when user clicks "Ask AI" in selection toolbar. */
  onAskAI?: (selectedText: string) => void;
  /** Callback to expose the scroll container to parent (vim j/k scrolling). */
  onScrollEl?: (el: HTMLDivElement | null) => void;
}

export function PdfViewer({ document: pdfDoc, chapters, onAskAI, onScrollEl }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Expose the scroll container to the parent (mirrors the iframe ref
  // callback pattern used by ChapterRenderer)
  useEffect(() => {
    onScrollEl?.(scrollRef.current);
    return () => {
      onScrollEl?.(null);
    };
  }, [onScrollEl]);

  const currentChapterIndex = useBookStore((state) => state.ui.currentChapterIndex);
  const setPendingScrollCfi = useBookStore((state) => state.setPendingScrollCfi);
  const pendingScrollCfi = useBookStore((state) => state.ui.pendingScrollCfi);
  const pendingScrollY = useBookStore((state) => state.ui.pendingScrollY);
  const setPendingScrollY = useBookStore((state) => state.setPendingScrollY);
  const setScrollPosition = useBookStore((state) => state.setScrollPosition);
  const setCurrentChapter = useBookStore((state) => state.setCurrentChapter);
  const setReadingProgress = useBookStore((state) => state.setReadingProgress);
  const currentBook = useBookStore((state) => state.currentBook);

  // --- PDF link navigation (citations, TOC, external URLs) ---
  const pdfNavigation = useBookStore((state) => state.ui.pdfNavigation);
  const setPdfNavigation = useBookStore((state) => state.setPdfNavigation);
  const [linkBackStack, setLinkBackStack] = useState<
    Array<{ pageNumber: number; scrollY: number }>
  >([]);

  const currentChapter = chapters[currentChapterIndex] ?? null;
  const pageNumber = currentChapterIndex + 1;

  // --- Zoom: fit-width base scale × user zoom multiplier (persisted) ---
  // Stored in ui.pdfZoom so the progress tracker persists it per book;
  // `?? 1` guards against stores seeded from partial state in tests, and
  // the clamp guards against corrupted saved values.
  const rawZoom = useBookStore((state) => state.ui.pdfZoom) ?? 1;
  const pdfZoom = Math.min(4, Math.max(0.3, rawZoom));
  const setPdfZoom = useBookStore((state) => state.setPdfZoom);
  const [fitScale, setFitScale] = useState(1);
  // Natural page width at scale 1 (null until measured)
  const pageWidthRef = useRef<number | null>(null);
  const fitPaddingX = 48;

  // Recompute fit scale from the scroll area width whenever either changes
  const recomputeFit = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || pageWidthRef.current === null) return;
    const available = scrollEl.clientWidth - fitPaddingX;
    if (available > 0) {
      setFitScale(Math.max(0.1, available / pageWidthRef.current));
    }
  }, []);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const observer = new ResizeObserver(() => recomputeFit());
    observer.observe(scrollEl);
    return () => observer.disconnect();
  }, [recomputeFit]);

  // Natural page width from the document (viewport at scale 1)
  useEffect(() => {
    let cancelled = false;
    async function measure() {
      try {
        const page = await pdfDoc.getPage(1);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        pageWidthRef.current = viewport.width;
        recomputeFit();
      } catch (err) {
        console.warn("[pdf] Failed to measure page width:", err);
      }
    }
    void measure();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, recomputeFit]);

  const scale = useMemo(
    () => Math.max(0.1, fitScale * pdfZoom),
    [fitScale, pdfZoom],
  );

  // --- Page render (canvas + text layer) ---
  // Dark mode is applied as a CSS filter on the canvas (see usePdfPage
  // docs for why pageColors is not used); no re-render on theme toggle.
  const {
    canvasRef,
    textLayerRef,
    pageLines,
    hasText,
    rendering,
    renderEpoch,
    error: renderError,
  } = usePdfPage(pdfDoc, pageNumber, scale);

  const chapterHref = currentChapter?.href ?? "";

  // --- Link layer: embedded /Link annotations for the current page ---
  const links = usePdfLinks(pdfDoc, pageNumber, scale);

  /** Jump to an internal link target (citation, TOC entry, ...). */
  const handleInternalLink = useCallback(
    (link: PdfLink) => {
      if (!link.target) return;
      const scrollEl = scrollRef.current;
      setLinkBackStack((stack) => [
        ...stack.slice(-19),
        { pageNumber, scrollY: scrollEl?.scrollTop ?? 0 },
      ]);
      setPdfNavigation({
        targetPage: link.target.pageNumber,
        targetY: link.target.y,
        sourcePage: pageNumber,
        sourceScrollY: scrollEl?.scrollTop ?? 0,
      });
    },
    [pageNumber, setPdfNavigation],
  );

  /** Open an external link with the system browser (opener plugin). */
  const handleExternalLink = useCallback((link: PdfLink) => {
    if (!link.url) return;
    openUrl(link.url).catch((err) => {
      console.warn("[pdf] Failed to open external link:", link.url, err);
    });
  }, []);

  /** Go back to the last link-jump origin. */
  const handleLinkBack = useCallback(() => {
    setLinkBackStack((stack) => {
      const entry = stack[stack.length - 1];
      if (!entry) return stack;
      const remaining = stack.slice(0, -1);
      const scrollEl = scrollRef.current;
      if (entry.pageNumber !== currentChapterIndex + 1) {
        setPdfNavigation({
          targetPage: entry.pageNumber,
          targetY: entry.scrollY,
          sourcePage: currentChapterIndex + 1,
          sourceScrollY: scrollEl?.scrollTop ?? 0,
        });
      } else {
        setPendingScrollY(entry.scrollY);
      }
      return remaining;
    });
  }, [currentChapterIndex, setPdfNavigation, setPendingScrollY]);

  // --- Scroll persistence: report container scroll to the store ---
  // Mirrors the EPUB iframe scroll tracker: the progress tracker saves
  // ui.scrollPosition (debounced), so the PDF scroll container must keep
  // it in sync while the user scrolls.
  const reportScrollRef = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let ticking = false;
    const postScroll = () => {
      ticking = false;
      // Skip store updates while programmatically applying a position
      // (page flip reset / restore) — same guard as the EPUB tracker
      if (reportScrollRef.current) return;
      setScrollPosition(el.scrollTop);
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(postScroll);
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [setScrollPosition]);

  // --- Scroll application: page flip reset + saved-position restore ---
  // Mirrors the EPUB useScrollTracking.handleIframeLoad semantics:
  // - Page flip: navigation already set ui.scrollPosition to 0 → apply it
  //   (the container itself would otherwise keep its scrollTop).
  // - Book open with saved progress: restoreProgress set ui.scrollPosition
  //   to the saved offset → apply after the page has rendered.
  //
  // The target is captured ONCE during the first render of the new page
  // (before any layout clamp scroll-events can pollute ui.scrollPosition),
  // then applied after the render completes (renderEpoch > 0).
  const lastAppliedPageRef = useRef<number | null>(null);
  const scrollTargetRef = useRef<number | null>(null);
  if (lastAppliedPageRef.current !== currentChapterIndex && scrollTargetRef.current === null) {
    scrollTargetRef.current = useBookStore.getState().ui.scrollPosition ?? 0;
  }

  useEffect(() => {
    if (renderEpoch === 0) return;
    const el = scrollRef.current;
    if (!el) return;

    // pendingScrollY is a one-shot absolute position (link-back nav)
    if (pendingScrollY !== null && pendingScrollY !== undefined) {
      reportScrollRef.current = true;
      el.scrollTop = pendingScrollY;
      setScrollPosition(pendingScrollY);
      setPendingScrollY(null);
      requestAnimationFrame(() => {
        reportScrollRef.current = false;
      });
      lastAppliedPageRef.current = currentChapterIndex;
      scrollTargetRef.current = null;
      return;
    }

    if (lastAppliedPageRef.current === currentChapterIndex) return;

    const target = scrollTargetRef.current ?? 0;
    reportScrollRef.current = true;
    el.scrollTop = target;
    // Keep the store in sync with the applied position
    setScrollPosition(target);
    requestAnimationFrame(() => {
      reportScrollRef.current = false;
    });
    lastAppliedPageRef.current = currentChapterIndex;
    scrollTargetRef.current = null;
  }, [renderEpoch, currentChapterIndex, pendingScrollY, setPendingScrollY, setScrollPosition]);

  // --- Consume pdfNavigation (internal link jumps, one-shot) ---
  // Cross-page: seed ui.scrollPosition with the target Y BEFORE switching
  // the chapter, so the capture-on-render in the scroll-apply effect above
  // lands exactly on the destination (a citation's footnote, not page top).
  // Same-page: apply the scroll directly.
  useEffect(() => {
    if (!pdfNavigation) return;
    setPdfNavigation(null); // one-shot

    const targetIndex = pdfNavigation.targetPage - 1;
    if (targetIndex < 0 || targetIndex >= chapters.length) return;

    if (targetIndex !== currentChapterIndex) {
      setScrollPosition(pdfNavigation.targetY);
      const chapter = chapters[targetIndex];
      setCurrentChapter(chapter.href, targetIndex);
      if (currentBook) {
        setReadingProgress({
          bookId: currentBook.id,
          chapterHref: chapter.href,
          chapterIndex: targetIndex,
          scrollOffset: 0,
          percentage: Math.round(((targetIndex + 1) / chapters.length) * 100),
        });
      }
    } else {
      const el = scrollRef.current;
      if (el) {
        reportScrollRef.current = true;
        el.scrollTop = pdfNavigation.targetY;
        setScrollPosition(pdfNavigation.targetY);
        requestAnimationFrame(() => {
          reportScrollRef.current = false;
        });
      }
    }
  }, [pdfNavigation, chapters, currentChapterIndex, currentBook, setCurrentChapter, setReadingProgress, setScrollPosition, setPdfNavigation]);

  // --- Selection + annotation bridges ---
  usePdfSelection({ textLayerRef, containerRef, renderEpoch, pageLines });
  usePdfAnnotations({
    textLayerRef,
    containerRef,
    renderEpoch,
    chapterHref,
  });

  // --- Summary ---
  const chapterText = useMemo(
    () => (currentChapter ? extractPlainText(currentChapter.content) : null),
    [currentChapter],
  );
  const summary = usePageSummary({
    chapterHref,
    chapterIndex: currentChapterIndex,
    chapterTitle: currentChapter?.title ?? null,
    chapterText,
  });

  // --- Consume pendingScrollCfi: scroll to + flash the target annotation ---
  useEffect(() => {
    if (!pendingScrollCfi || renderEpoch === 0) return;
    const root = textLayerRef.current;
    const scrollEl = scrollRef.current;
    if (!root || !scrollEl) return;

    const offsets = parseCfiOffsets(pendingScrollCfi);
    if (!offsets) return;

    wrapRange(
      root,
      offsets.start,
      offsets.end,
      "anno-highlight",
      "background-color: rgba(59, 130, 246, 0.45);",
      { "flash-target": "true" },
    );

    // Scroll the annotation into view (mirrors EPUB scrollToCharOffset):
    // the flash target's position within the scroll container determines
    // the scrollTop that centers it around one third from the top.
    const flashEl = root.querySelector('.anno-highlight[data-flash-target="true"]');
    if (flashEl) {
      const scrollRect = scrollEl.getBoundingClientRect();
      const rect = flashEl.getBoundingClientRect();
      const targetScrollTop =
        scrollEl.scrollTop + (rect.top - scrollRect.top) - scrollRect.height / 3;
      reportScrollRef.current = true;
      scrollEl.scrollTop = Math.max(0, targetScrollTop);
      setScrollPosition(scrollEl.scrollTop);
      requestAnimationFrame(() => {
        reportScrollRef.current = false;
      });
    }

    // Remove the flash after a moment (next annotations pass also clears it)
    window.setTimeout(() => {
      root.querySelectorAll('.anno-highlight[data-flash-target="true"]').forEach((el) => {
        el.remove();
        root.normalize();
      });
    }, 1600);

    setPendingScrollCfi(null);
  }, [pendingScrollCfi, renderEpoch, textLayerRef, setPendingScrollCfi, setScrollPosition]);

  const handleZoomIn = useCallback(
    () => setPdfZoom(Math.min(4, +(pdfZoom + 0.2).toFixed(2))),
    [pdfZoom, setPdfZoom],
  );
  const handleZoomOut = useCallback(
    () => setPdfZoom(Math.max(0.3, +(pdfZoom - 0.2).toFixed(2))),
    [pdfZoom, setPdfZoom],
  );
  const handleZoomReset = useCallback(() => setPdfZoom(1), [setPdfZoom]);

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Scrollable page area */}
      <div ref={scrollRef} className="flex-1 overflow-auto bg-bg dark:bg-bg-dark">
        <div className="flex flex-col items-center gap-4 py-6 px-6">
          {/* Streaming AI summary card for the current page */}
          <PageSummaryCard
            status={summary.status}
            content={summary.content}
            hasSummary={summary.hasSummary}
            error={summary.error}
            onRun={() => void summary.run()}
            onDismiss={summary.dismiss}
          />

          {renderError && (
            <div className="max-w-[720px] w-full p-2 px-4 rounded-md bg-error-bg dark:bg-error-bg-dark border border-error dark:border-error">
              <span className="text-sm text-error dark:text-error">{renderError}</span>
            </div>
          )}

          {!hasText && renderEpoch > 0 && !rendering && (
            <div className="max-w-[720px] w-full p-2 px-4 rounded-md bg-surface dark:bg-surface-dark border border-border dark:border-border-dark">
              <span className="text-xs text-text-secondary dark:text-text-secondary-dark">
                This page has no extractable text (likely a scanned image).
                Text selection, highlights, and AI features are unavailable on it.
              </span>
            </div>
          )}

          {/* Page canvas + text layer */}
          <div ref={containerRef} className="pdfPageWrap relative shadow-md rounded-sm">
            <canvas
              ref={canvasRef}
              className="block bg-white rounded-sm dark:invert-[.9] dark:hue-rotate-180"
            />
            <div ref={textLayerRef} className="pdfTextLayer" />

            {/* Link layer: embedded /Link annotations (citations [32] →
                bibliography, TOC entries, external URLs). Anchors only —
                the layer itself is pointer-events:none so text selection
                drags pass through the empty areas. */}
            <div className="pdfLinkLayer">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={link.url ?? "#"}
                  className="pdfLinkAnchor"
                  style={{
                    left: `${link.rect.left}px`,
                    top: `${link.rect.top}px`,
                    width: `${link.rect.width}px`,
                    height: `${link.rect.height}px`,
                  }}
                  title={link.url ?? `Go to page ${link.target?.pageNumber ?? ""}`}
                  target={link.url ? "_blank" : undefined}
                  rel={link.url ? "noreferrer" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    if (link.url) {
                      handleExternalLink(link);
                    } else {
                      handleInternalLink(link);
                    }
                  }}
                />
              ))}
            </div>

            {rendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-bg/60 dark:bg-bg-dark/60 z-10">
                <div className="w-8 h-8 border-2 border-border dark:border-border-dark border-t-accent dark:border-t-accent-dark rounded-full animate-spin" />
              </div>
            )}

            {/* Shared selection / annotation / translation overlays.
                MUST render inside the container (pdfPageWrap): the selection
                rects are computed relative to this element (toContainerRect),
                and the absolutely-positioned toolbar/popovers resolve against
                their nearest positioned ancestor — which is this element only
                when rendered here. Placing them at the viewer root made the
                toolbar drift by the page's offset (scroll/zoom/summary card),
                i.e. a different wrong position on every selection. */}
            <ReaderOverlays
              containerRef={containerRef}
              chapterHref={chapterHref}
              chapterText={chapterText}
              onAskAI={onAskAI}
            />
          </div>
        </div>
      </div>

      {/* Link-jump back button (mirrors the EPUB link-navigation back) */}
      {linkBackStack.length > 0 && (
        <button
          onClick={handleLinkBack}
          title="Go back"
          className="absolute bottom-16 left-4 z-40 w-9 h-9 rounded-full bg-surface dark:bg-surface-dark border border-border dark:border-border-dark shadow-md flex items-center justify-center text-text dark:text-text-dark hover:bg-surface dark:hover:bg-surface-dark transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
        </button>
      )}

      {/* Floating zoom controls */}
      <div className="absolute bottom-16 right-4 z-40 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="w-9 h-9 rounded-full bg-surface dark:bg-surface-dark border border-border dark:border-border-dark shadow-md flex items-center justify-center text-text dark:text-text-dark hover:bg-surface dark:hover:bg-surface-dark transition-colors cursor-pointer"
          title="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={handleZoomReset}
          className="w-9 h-9 rounded-full bg-surface dark:bg-surface-dark border border-border dark:border-border-dark shadow-md flex items-center justify-center text-text dark:text-text-dark hover:bg-surface dark:hover:bg-surface-dark transition-colors cursor-pointer"
          title="Reset zoom (fit width)"
        >
          <Maximize size={16} />
        </button>
        <button
          onClick={handleZoomOut}
          className="w-9 h-9 rounded-full bg-surface dark:bg-surface-dark border border-border dark:border-border-dark shadow-md flex items-center justify-center text-text dark:text-text-dark hover:bg-surface dark:hover:bg-surface-dark transition-colors cursor-pointer"
          title="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
      </div>
    </div>
  );
}
