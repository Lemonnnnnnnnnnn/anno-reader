/**
 * PdfViewer component.
 *
 * Renders PDF pages with pdf.js: canvas painting + transparent text
 * layer for text selection and annotation overlays. Page navigation is
 * driven by the shared chapter state (ui.currentChapterIndex) — each PDF
 * page is a "chapter" — so ChapterNavigation, keyboard nav, TOC, and
 * progress tracking work unchanged.
 *
 * Selection and annotation UX reuse the shared ReaderOverlays via the
 * window postMessage contract (see ReaderOverlays/index.tsx).
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useBookStore } from "@/stores/useBookStore";
import { ReaderOverlays } from "../ReaderOverlays";
import { usePdfPage } from "./hooks/usePdfPage";
import { usePdfAnnotations } from "./hooks/usePdfAnnotations";
import { usePdfSelection } from "./hooks/usePdfSelection";
import { usePageSummary } from "./hooks/usePageSummary";
import { PageSummaryCard } from "./PageSummaryCard";
import { extractPlainText } from "../ChapterRenderer";
import type { EpubChapterInfo } from "@/lib/epub/types";
import { parseCfiOffsets, wrapRange } from "./textLayerDom";

interface PdfViewerProps {
  /** Live pdf.js document handle. */
  document: PDFDocumentProxy;
  /** Parsed book view (pages as chapters). */
  chapters: EpubChapterInfo[];
  /** Callback when user clicks "Ask AI" in selection toolbar. */
  onAskAI?: (selectedText: string) => void;
}

export function PdfViewer({ document: pdfDoc, chapters, onAskAI }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentChapterIndex = useBookStore((state) => state.ui.currentChapterIndex);
  const theme = useBookStore((state) => state.ui.theme);
  const setPendingScrollCfi = useBookStore((state) => state.setPendingScrollCfi);
  const pendingScrollCfi = useBookStore((state) => state.ui.pendingScrollCfi);

  const currentChapter = chapters[currentChapterIndex] ?? null;
  const pageNumber = currentChapterIndex + 1;

  // --- Zoom: fit-width base scale × user zoom multiplier ---
  const [zoom, setZoom] = useState(1);
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
    () => Math.max(0.1, fitScale * zoom),
    [fitScale, zoom],
  );

  // --- Page render (canvas + text layer) ---
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

  // --- Selection + annotation bridges ---
  usePdfSelection({ textLayerRef, containerRef, renderEpoch, pageLines });
  usePdfAnnotations({
    textLayerRef,
    containerRef,
    renderEpoch,
    chapterHref,
    theme,
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

  // --- Consume pendingScrollCfi: flash the target annotation on this page ---
  useEffect(() => {
    if (!pendingScrollCfi || renderEpoch === 0) return;
    const root = textLayerRef.current;
    if (!root) return;

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
    // Remove the flash after a moment (next annotations pass also clears it)
    window.setTimeout(() => {
      root.querySelectorAll('.anno-highlight[data-flash-target="true"]').forEach((el) => {
        el.remove();
        root.normalize();
      });
    }, 1600);

    setPendingScrollCfi(null);
  }, [pendingScrollCfi, renderEpoch, textLayerRef, setPendingScrollCfi]);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2))), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(0.3, +(z - 0.2).toFixed(2))), []);
  const handleZoomReset = useCallback(() => setZoom(1), []);

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
              className="block bg-white dark:bg-white rounded-sm"
            />
            <div ref={textLayerRef} className="pdfTextLayer" />
            {rendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-bg/60 dark:bg-bg-dark/60 z-10">
                <div className="w-8 h-8 border-2 border-border dark:border-border-dark border-t-accent dark:border-t-accent-dark rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

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

      {/* Shared selection / annotation / translation overlays */}
      <ReaderOverlays
        containerRef={containerRef}
        chapterHref={chapterHref}
        chapterText={chapterText}
        onAskAI={onAskAI}
      />
    </div>
  );
}
