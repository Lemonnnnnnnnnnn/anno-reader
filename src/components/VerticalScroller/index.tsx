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
import { injectSelectionScript, generateCfiRange } from "@/lib/selection";
import { TextSelectionToolbar } from "../TextSelectionToolbar";
import { AnnotationDetailPanel } from "../AnnotationDetailPanel";
import { AITranslationPanel } from "../AITranslationPanel";
import { useScrollTracking, useAnnotationSync } from "./hooks";
import { injectScrollScript } from "./hooks/useScrollTracking";

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
}

export function VerticalScroller({
  srcdoc,
  chapterText,
  chapterIndex,
  chapterHref,
  title,
  onIframeRef,
}: VerticalScrollerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Annotation popover state
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // AI translation panel state
  const [translationPanel, setTranslationPanel] = useState<{
    selectedText: string;
    chapterHref: string;
    startOffset: number;
    endOffset: number;
    forcePreview?: boolean;
  } | null>(null);

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

  // Listen for note-click messages from iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "note-click" && event.data.noteId) {
        setActiveNoteId(event.data.noteId);
        // Close translation panel (mutual exclusivity)
        setTranslationPanel(null);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleClosePopover = useCallback(() => {
    setActiveNoteId(null);
  }, []);

  const handleTranslate = useCallback((data: {
    selectedText: string;
    chapterHref: string;
    startOffset: number;
    endOffset: number;
  }, options?: { forcePreview?: boolean }) => {
    setTranslationPanel({ ...data, forcePreview: options?.forcePreview });
    // Close annotation detail panel (mutual exclusivity)
    setActiveNoteId(null);
  }, []);

  const handleCloseTranslationPanel = useCallback(() => {
    setTranslationPanel(null);
  }, []);

  // Build the final srcdoc with scroll tracker, selection detector, and annotations injected
  const srcdocWithTracking = useMemo(() => {
    const withScroll = injectScrollScript(srcdoc);
    const withSelection = injectSelectionScript(withScroll);
    // Inject annotation script before closing body
    const closingBody = "</body>";
    const idx = withSelection.lastIndexOf(closingBody);
    if (idx === -1) return withSelection + annotationScript;
    return withSelection.slice(0, idx) + annotationScript + withSelection.slice(idx);
  }, [srcdoc]); // Only depend on srcdoc, not annotationScript - annotations update via postMessage

  // Compute skipPreview: forcePreview presence inverts it, otherwise DEV→skip=false, PROD→skip=true
  const skipPreview = translationPanel?.forcePreview !== undefined
    ? !translationPanel.forcePreview
    : !import.meta.env.DEV;

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden relative">
      <iframe
        ref={iframeRef}
        srcDoc={srcdocWithTracking}
        title={title || `Chapter ${chapterIndex + 1}`}
        className="w-full h-full border-none bg-bg"
        sandbox="allow-same-origin allow-scripts"
        onLoad={handleIframeLoad}
      />
      <TextSelectionToolbar
        containerRef={containerRef}
        chapterHref={chapterHref}
        onTranslate={handleTranslate}
      />
      <AnnotationDetailPanel
        noteId={activeNoteId}
        onClose={handleClosePopover}
      />
      <AITranslationPanel
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
        isOpen={!!translationPanel}
        onClose={handleCloseTranslationPanel}
        skipPreview={skipPreview}
      />
    </div>
  );
}
