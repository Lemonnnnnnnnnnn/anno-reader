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

import { useRef, useMemo, useEffect } from "react";
import { injectSelectionScript } from "@/lib/selection";
import { TextSelectionToolbar } from "../TextSelectionToolbar";
import { useScrollTracking, useAnnotationSync } from "./hooks";
import { injectScrollScript } from "./hooks/useScrollTracking";

interface VerticalScrollerProps {
  /** Complete HTML string for the iframe srcdoc */
  srcdoc: string;
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
  chapterIndex,
  chapterHref,
  title,
  onIframeRef,
}: VerticalScrollerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden relative">
      <iframe
        ref={iframeRef}
        srcDoc={srcdocWithTracking}
        title={title || `Chapter ${chapterIndex + 1}`}
        className="w-full h-full border-none bg-[#fafafa]"
        sandbox="allow-same-origin allow-scripts"
        onLoad={handleIframeLoad}
      />
      <TextSelectionToolbar
        containerRef={containerRef}
        chapterHref={chapterHref}
      />
    </div>
  );
}
