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
import { useBookStore } from "@/stores/useBookStore";
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
  /** Optional title for the iframe */
  title?: string;
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
  title,
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

  // Look up the full highlight object from the store
  const activeHighlight = useBookStore((state) =>
    activeHighlightId
      ? state.highlights.find((h) => h.id === activeHighlightId) ?? null
      : null,
  );
  const currentBook = useBookStore((state) => state.currentBook);

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

  // Build the final srcdoc with scroll tracker, keyboard forwarder, selection detector, and annotations injected
  const srcdocWithTracking = useMemo(() => {
    const withScroll = injectScrollScript(srcdoc);
    const withKeyboard = injectKeyboardScript(withScroll);
    const withSelection = injectSelectionScript(withKeyboard);
    const withLinks = injectLinkNavigationScript(withSelection);
    // Inject annotation script before closing body
    const closingBody = "</body>";
    const idx = withLinks.lastIndexOf(closingBody);
    if (idx === -1) return withLinks + annotationScript;
    return withLinks.slice(0, idx) + annotationScript + withLinks.slice(idx);
  }, [srcdoc]); // Only depend on srcdoc, not annotationScript - annotations update via postMessage

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden relative">
      <iframe
        ref={iframeRef}
        srcDoc={srcdocWithTracking}
        title={title || `Chapter ${chapterIndex + 1}`}
        className="w-full h-full border-none bg-bg dark:bg-bg-dark"
        sandbox="allow-same-origin allow-scripts"
        onLoad={handleIframeLoad}
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
