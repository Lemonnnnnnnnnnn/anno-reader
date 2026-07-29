/**
 * VerticalScroller component.
 *
 * Manages vertical scrolling within EPUB chapter iframes. Handles:
 * - Smooth scrolling behavior within chapters
 * - Scroll position tracking via postMessage from iframe
 * - Progress updates to the Zustand store on scroll
 * - Scroll restoration when loading a chapter with saved progress
 *
 * Communication with the iframe uses postMessage: a script injected
 * into the srcdoc posts scroll events to the parent window, which
 * this component listens for and forwards to the store.
 *
 * @example
 * ```tsx
 * <VerticalScroller
 *   srcdoc={html}
 *   chapterIndex={0}
 *   chapterHref="Text/chapter1.xhtml"
 * />
 * ```
 */

import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { injectSelectionScript, generateCfiRange } from "@/lib/selection";
import { updateHighlight, deleteHighlight } from "@/lib/annotations";
import {
  createSummary,
  updateSummary,
  generateSummaryStream,
} from "@/lib/summaries";
import { injectSummaryButton } from "@/lib/summaries/injectSummaryButton";
import { useBookStore } from "@/stores/useBookStore";
import { injectCssIntoIframe } from "@/lib/css";
import { TextSelectionToolbar } from "../TextSelectionToolbar";
import { AnnotationDetailDrawer } from "../AnnotationDetailDrawer";
import { HighlightPopover } from "../HighlightPopover";
import { AITranslationPanel } from "../AITranslationPanel";
import { injectLinkNavigationScript, type LinkClickMessage } from "@/lib/linkNavigation";
import { useScrollTracking, useAnnotationSync } from "./hooks";
import { injectScrollScript, injectKeyboardScript } from "./hooks/useScrollTracking";

interface VerticalScrollerProps {
  /** Complete HTML string for the iframe srcdoc */
  srcdoc: string;
  /** Plain text content of the chapter (for AI translation context) */
  chapterText: string | null;
  /** Current chapter index (triggers scroll restoration on change) */
  chapterIndex: number;
  /** Current chapter href (for progress tracking) */
  chapterHref: string;
  /** Chapter title (for AI summary context) */
  chapterTitle?: string | null;
  /** Optional title for the iframe */
  title?: string;
  /** Font size in pixels for dynamic CSS injection (preserves scroll position) */
  fontSize?: number;
  /** Callback to expose the iframe element ref to parent components */
  onIframeRef?: (ref: HTMLIFrameElement | null) => void;
  /** Callback when user clicks "Ask AI" in selection toolbar */
  onAskAI?: (selectedText: string) => void;
  /** Callback when an inline EPUB link is clicked */
  onLinkClick?: (href: string) => void;
  /** Whether link navigation has a previous location to return to */
  canGoBack?: boolean;
  /** Callback when user clicks the link-navigation back button */
  onLinkBack?: () => void;
}

export function VerticalScroller({
  srcdoc,
  chapterText,
  chapterIndex,
  chapterHref,
  chapterTitle,
  title,
  fontSize,
  onIframeRef,
  onAskAI,
  onLinkClick,
  canGoBack = false,
  onLinkBack,
}: VerticalScrollerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Annotation popover state
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // Highlight popover state
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [highlightPosition, setHighlightPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // Dismiss highlight popover on chapter navigation
  useEffect(() => {
    setActiveHighlightId(null);
    setHighlightPosition(null);
  }, [chapterHref]);

  // Cancel any in-flight summary generation when the chapter changes or on unmount.
  useEffect(() => {
    return () => {
      summaryAbortRef.current?.abort();
      summaryAbortRef.current = null;
    };
  }, [chapterHref]);

  // Look up the full highlight object from the store
  const activeHighlight = useBookStore((state) =>
    activeHighlightId
      ? state.highlights.find((h) => h.id === activeHighlightId) ?? null
      : null,
  );
  const currentBook = useBookStore((state) => state.currentBook);

  // Existing summary for the current chapter (drives injected button state).
  const existingSummary = useBookStore((state) =>
    state.summaries.find(
      (s) =>
        s.chapterHref === chapterHref &&
        (!state.currentBook || s.bookId === state.currentBook.id),
    ) ?? null,
  );

  // AbortController for the in-flight summary generation; cancelled on unmount
  // or chapter change.
  const summaryAbortRef = useRef<AbortController | null>(null);
  // Live refs so the postMessage handler (registered once) always reads
  // the latest values without re-subscribing.
  const chapterHrefRef = useRef(chapterHref);
  const chapterIndexRef = useRef(chapterIndex);
  const chapterTitleRef = useRef(chapterTitle);
  const chapterTextRef = useRef(chapterText);
  const existingSummaryRef = useRef(existingSummary);
  const currentBookRef = useRef(currentBook);
  useEffect(() => {
    chapterHrefRef.current = chapterHref;
    chapterIndexRef.current = chapterIndex;
    chapterTitleRef.current = chapterTitle;
    chapterTextRef.current = chapterText;
    existingSummaryRef.current = existingSummary;
    currentBookRef.current = currentBook;
  }, [chapterHref, chapterIndex, chapterTitle, chapterText, existingSummary, currentBook]);

  // AI translation panel state
  const [translationPanel, setTranslationPanel] = useState<{
    selectedText: string;
    chapterHref: string;
    startOffset: number;
    endOffset: number;
    sentence?: string;
    paragraph?: string;
  } | null>(null);

  const onLinkClickRef = useRef(onLinkClick);
  useEffect(() => {
    onLinkClickRef.current = onLinkClick;
  }, [onLinkClick]);

  // Scroll position tracking and restoration
  const { iframeRef, handleIframeLoad } = useScrollTracking(chapterHref);

  // Expose iframe ref to parent
  useEffect(() => {
    onIframeRef?.(iframeRef.current);
    return () => {
      onIframeRef?.(null);
    };
  }, [iframeRef, onIframeRef]);

  // Inject font size into iframe (called on load and when fontSize changes)
  const injectFontSize = useCallback(() => {
    if (!fontSize || !iframeRef.current) return;
    const iframe = iframeRef.current;
    // Wait for iframe content to be ready
    if (!iframe.contentDocument?.body) return;
    const css = `body { font-size: ${fontSize}px !important; }`;
    injectCssIntoIframe(iframe, css, "font-size-override");
  }, [fontSize, iframeRef]);

  // Post a summary-init message to the iframe so the injected summary card
  // reflects the persisted state (button vs. existing summary) after load.
  // Uses refs so the load handler stays stable across summary changes.
  const postToIframe = useCallback(
    (message: unknown) => {
      const iframe = iframeRef.current;
      iframe?.contentWindow?.postMessage(message, "*");
    },
    [iframeRef],
  );

  // Inject font size when iframe loads
  const handleIframeLoadWithFontSize = useCallback(() => {
    handleIframeLoad();
    // Inject font size after iframe is loaded
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      injectFontSize();
      // After the iframe DOM is ready, seed the summary card state. A short
      // delay lets the injected summary script attach its message listener.
      setTimeout(() => {
        const existing = existingSummaryRef.current;
        postToIframe({
          type: "summary-init",
          hasSummary: !!existing,
          content: existing?.content ?? null,
        });
      }, 0);
    });
  }, [handleIframeLoad, injectFontSize, postToIframe]);

  // Inject font size when fontSize changes (runtime adjustment)
  useEffect(() => {
    injectFontSize();
  }, [fontSize, injectFontSize]);

  // Annotation state and synchronization
  const { annotationScript } = useAnnotationSync(chapterHref, iframeRef);

  // Listen for note-click and highlight-click messages from iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "note-click" && event.data.noteId) {
        setActiveNoteId(event.data.noteId);
        // Close highlight popover and translation panel (mutual exclusivity)
        setActiveHighlightId(null);
        setHighlightPosition(null);
        setTranslationPanel(null);
      }
      if (event.data?.type === "highlight-click" && event.data.highlightId) {
        setActiveHighlightId(event.data.highlightId);
        // Position the popover near the highlight span
        const rect = event.data.rect;
        if (rect) {
          setHighlightPosition({
            top: rect.bottom + 8,
            left: rect.left + rect.width / 2 - 130,
          });
        }
        // Close note detail panel and translation panel (mutual exclusivity)
        setActiveNoteId(null);
        setTranslationPanel(null);
      }
      if (event.data?.type === "link-click") {
        const msg = event.data as LinkClickMessage;
        onLinkClickRef.current?.(msg.href);
        // Close other floating UI (mutual exclusivity for link navigation)
        setActiveNoteId(null);
        setActiveHighlightId(null);
        setHighlightPosition(null);
        setTranslationPanel(null);
      }
      if (event.data?.type === "close-popovers") {
        // Close all popovers when clicking on empty area in iframe
        setActiveNoteId(null);
        setActiveHighlightId(null);
        setHighlightPosition(null);
      }
      if (event.data?.type === "summary-click") {
        // Trigger (or re-trigger) streaming chapter summary generation.
        void runSummaryRef.current();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleClosePopover = useCallback(() => {
    setActiveNoteId(null);
  }, []);

  const handleCloseHighlightPopover = useCallback(() => {
    setActiveHighlightId(null);
    setHighlightPosition(null);
  }, []);

  const handleHighlightColorChange = useCallback((color: string) => {
    if (!activeHighlightId || !currentBook) return;
    updateHighlight(activeHighlightId, { color }, currentBook.id);
  }, [activeHighlightId, currentBook]);

  const handleHighlightDelete = useCallback(() => {
    if (!activeHighlightId || !currentBook) return;
    deleteHighlight(activeHighlightId, currentBook.id);
    setActiveHighlightId(null);
    setHighlightPosition(null);
  }, [activeHighlightId, currentBook]);

  const handleTranslate = useCallback((data: {
    selectedText: string;
    chapterHref: string;
    startOffset: number;
    endOffset: number;
    sentence?: string;
    paragraph?: string;
  }) => {
    setTranslationPanel(data);
    // Close annotation detail panel and highlight popover (mutual exclusivity)
    setActiveNoteId(null);
    setActiveHighlightId(null);
    setHighlightPosition(null);
  }, []);

  const handleCloseTranslationPanel = useCallback(() => {
    setTranslationPanel(null);
  }, []);

  /**
   * Run a streaming chapter summary for the current chapter.
   * Streams chunks into the iframe and persists the final result.
   * Cancels any in-flight generation first.
   */
  const runSummary = useCallback(async () => {
    const book = currentBookRef.current;
    const href = chapterHrefRef.current;
    const text = chapterTextRef.current;
    if (!book || !href) return;

    // No usable chapter text — surface an error in the card.
    if (!text || text.trim().length === 0) {
      postToIframe({
        type: "summary-error",
        message: "本章没有可总结的文本内容。",
      });
      return;
    }

    // Tell the iframe to enter streaming state immediately so the spinner
    // shows before the first chunk arrives.
    postToIframe({ type: "summary-stream-start" });

    // Cancel any previous stream.
    summaryAbortRef.current?.abort();
    const controller = new AbortController();
    summaryAbortRef.current = controller;

    try {
      const fullText = await generateSummaryStream({
        chapterText: text,
        chapterTitle: chapterTitleRef.current,
        abortSignal: controller.signal,
        onChunk: (accumulated) => {
          postToIframe({
            type: "summary-stream-chunk",
            text: accumulated,
          });
        },
      });

      // Persist: overwrite the existing summary or create a new one.
      const existing = existingSummaryRef.current;
      if (existing) {
        await updateSummary(existing.id, fullText, book.id);
      } else {
        const created = await createSummary(
          book.id,
          href,
          chapterIndexRef.current,
          chapterTitleRef.current ?? null,
          fullText,
        );
        existingSummaryRef.current = created;
      }

      postToIframe({ type: "summary-done", content: fullText });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "生成总结失败";
      postToIframe({ type: "summary-error", message });
    } finally {
      if (summaryAbortRef.current === controller) {
        summaryAbortRef.current = null;
      }
    }
  }, [postToIframe]);

  // Keep a ref so the once-registered message listener always calls the
  // latest runSummary without needing to re-subscribe.
  const runSummaryRef = useRef(runSummary);
  useEffect(() => {
    runSummaryRef.current = runSummary;
  }, [runSummary]);

  // Build the final srcdoc with scroll tracker, keyboard forwarder, selection detector, and annotations injected.
  // The summary trigger/card is stateless here — its real state is pushed via postMessage
  // after the iframe loads (see summary-init). This keeps srcdoc stable across summary
  // create/update so the iframe is not rebuilt and scroll position is preserved.
  const srcdocWithTracking = useMemo(() => {
    const withScroll = injectScrollScript(srcdoc);
    const withKeyboard = injectKeyboardScript(withScroll);
    const withSelection = injectSelectionScript(withKeyboard);
    const withLinks = injectLinkNavigationScript(withSelection);
    // Inject summary trigger/card before closing body
    const withSummary = injectSummaryButton(withLinks);
    // Inject annotation script before closing body
    const closingBody = "</body>";
    const idx = withSummary.lastIndexOf(closingBody);
    if (idx === -1) return withSummary + annotationScript;
    return withSummary.slice(0, idx) + annotationScript + withSummary.slice(idx);
  }, [srcdoc]); // Only depend on srcdoc — summary state is driven via postMessage

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden relative">
      <iframe
        ref={iframeRef}
        srcDoc={srcdocWithTracking}
        title={title || `Chapter ${chapterIndex + 1}`}
        className="w-full h-full border-none bg-bg dark:bg-bg-dark"
        sandbox="allow-same-origin allow-scripts"
        onLoad={handleIframeLoadWithFontSize}
      />
      <TextSelectionToolbar
        containerRef={containerRef}
        chapterHref={chapterHref}
        onTranslate={handleTranslate}
        onAskAI={onAskAI}
      />
      <AnnotationDetailDrawer
        noteId={activeNoteId}
        onClose={handleClosePopover}
      />
      {activeHighlight && highlightPosition && (
        <HighlightPopover
          highlight={activeHighlight}
          position={highlightPosition}
          onColorChange={handleHighlightColorChange}
          onDelete={handleHighlightDelete}
          onClose={handleCloseHighlightPopover}
        />
      )}
      {translationPanel && <AITranslationPanel
        selectedText={translationPanel?.selectedText ?? ""}
        chapterText={chapterText}
        chapterHref={translationPanel?.chapterHref ?? ""}
        cfiRange={
          translationPanel
            ? generateCfiRange(
              translationPanel.chapterHref,
              translationPanel.startOffset,
              translationPanel.endOffset,
            )
            : ""
        }
        startOffset={translationPanel?.startOffset ?? 0}
        endOffset={translationPanel?.endOffset ?? 0}
        sentence={translationPanel?.sentence}
        isOpen={!!translationPanel}
        onClose={handleCloseTranslationPanel}
      />}
      {canGoBack && onLinkBack && (
        <button
          onClick={onLinkBack}
          title="Go back"
          className="absolute bottom-4 left-4 z-50 w-9 h-9 rounded-full bg-surface dark:bg-surface-dark border border-border dark:border-border-dark shadow-md flex items-center justify-center text-text dark:text-text-dark hover:bg-surface dark:hover:bg-surface-dark transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
        </button>
      )}
    </div>
  );
}
