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

import { useEffect, useRef, useCallback, useMemo } from "react";
import { useBookStore } from "@/stores/useBookStore";
import { useShallow } from "zustand/shallow";
import { injectSelectionScript } from "@/lib/selection";
import { TextSelectionToolbar } from "./TextSelectionToolbar";

/** Message shape posted from the iframe scroll tracker script */
interface ScrollMessage {
  type: "scroll-position";
  scrollY: number;
  maxScroll: number;
}

interface VerticalScrollerProps {
  /** Complete HTML string for the iframe srcdoc */
  srcdoc: string;
  /** Current chapter index (triggers scroll restoration on change) */
  chapterIndex: number;
  /** Current chapter href (for progress tracking) */
  chapterHref: string;
  /** Optional title for the iframe */
  title?: string;
}

/**
 * Script injected into the iframe srcdoc to track scroll position.
 * Uses requestAnimationFrame for smooth, throttled updates.
 * Posts messages to parent window when scroll position changes.
 */
const SCROLL_TRACKER_SCRIPT = `
<script>
(function() {
  var ticking = false;
  var lastScrollY = 0;

  function postScroll() {
    var scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    var docHeight = document.documentElement.scrollHeight || 0;
    var maxScroll = Math.max(0, docHeight - window.innerHeight);

    // Only post if position actually changed
    if (scrollY !== lastScrollY) {
      lastScrollY = scrollY;
      window.parent.postMessage({
        type: 'scroll-position',
        scrollY: scrollY,
        maxScroll: maxScroll
      }, '*');
    }
    ticking = false;
  }

  window.addEventListener('scroll', function() {
    if (!ticking) {
      window.requestAnimationFrame(postScroll);
      ticking = true;
    }
  }, { passive: true });

  // Post initial position after content loads
  window.addEventListener('load', function() {
    setTimeout(postScroll, 50);
  });
})();
</script>`;

/**
 * Inject the scroll tracker script into an srcdoc HTML string.
 * Appends the script just before the closing </body> tag.
 */
function injectScrollScript(srcdoc: string): string {
  const closingBody = "</body>";
  const idx = srcdoc.lastIndexOf(closingBody);
  if (idx === -1) {
    // No closing body tag — append at end
    return srcdoc + SCROLL_TRACKER_SCRIPT;
  }
  return srcdoc.slice(0, idx) + SCROLL_TRACKER_SCRIPT + srcdoc.slice(idx);
}

/**
 * Build a script that renders highlights and note markers in the iframe.
 * Supports dynamic updates via postMessage to avoid iframe reload.
 *
 * The script:
 * 1. Renders initial annotations on load
 * 2. Listens for 'annotation-update' messages to update dynamically
 * 3. Provides clearAnnotations() to remove old annotations before re-rendering
 */
function buildAnnotationScript(
  highlights: Array<{ id: string; cfiRange: string; color: string }>,
  notes: Array<{ id: string; cfiRange: string; text: string }>,
): string {
  const highlightsJson = JSON.stringify(highlights);
  const notesJson = JSON.stringify(notes);

  return `
<script>
(function() {
  var currentHighlights = ${highlightsJson};
  var currentNotes = ${notesJson};

  function parseCfiOffsets(cfi) {
    var match = cfi.match(/:(\\d+),(\\d+)\\)$/);
    if (!match) return null;
    return { start: parseInt(match[1], 10), end: parseInt(match[2], 10) };
  }

  function getTextNodes(root) {
    var nodes = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.length > 0) {
        nodes.push(walker.currentNode);
      }
    }
    return nodes;
  }

  function wrapRange(startOffset, endOffset, className, style) {
    var body = document.body;
    var textNodes = getTextNodes(body);
    var currentOffset = 0;
    var startNode, startNodeOffset, endNode, endNodeOffset;

    for (var i = 0; i < textNodes.length; i++) {
      var node = textNodes[i];
      var nodeLen = node.textContent.length;

      if (!startNode && currentOffset + nodeLen > startOffset) {
        startNode = node;
        startNodeOffset = startOffset - currentOffset;
      }
      if (currentOffset + nodeLen >= endOffset) {
        endNode = node;
        endNodeOffset = endOffset - currentOffset;
        break;
      }
      currentOffset += nodeLen;
    }

    if (!startNode || !endNode) return;

    try {
      var range = document.createRange();
      range.setStart(startNode, startNodeOffset);
      range.setEnd(endNode, endNodeOffset);

      var span = document.createElement('span');
      span.className = className;
      if (style) span.setAttribute('style', style);
      range.surroundContents(span);
    } catch(e) {
      // Range wrapping can fail on complex selections; skip silently
    }
  }

  function clearAnnotations() {
    // Remove highlight spans (unwrap them, keeping text content)
    var highlightSpans = document.querySelectorAll('.anno-highlight');
    highlightSpans.forEach(function(span) {
      var parent = span.parentNode;
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
    });

    // Remove note markers
    var noteMarkers = document.querySelectorAll('.anno-note-marker');
    noteMarkers.forEach(function(marker) {
      marker.parentNode.removeChild(marker);
    });

    // Normalize to merge adjacent text nodes
    document.body.normalize();
  }

  function renderHighlights(highlights) {
    for (var h = 0; h < highlights.length; h++) {
      var hl = highlights[h];
      var offsets = parseCfiOffsets(hl.cfiRange);
      if (!offsets) continue;
      wrapRange(offsets.start, offsets.end, 'anno-highlight',
        'background-color: ' + hl.color + '; border-radius: 2px; padding: 1px 0;');
    }
  }

  function renderNotes(notes) {
    for (var n = 0; n < notes.length; n++) {
      var note = notes[n];
      var noteOffsets = parseCfiOffsets(note.cfiRange);
      if (!noteOffsets) continue;

      var body = document.body;
      var textNodes = getTextNodes(body);
      var curOffset = 0;
      var targetNode, targetNodeOffset;

      for (var i = 0; i < textNodes.length; i++) {
        var node = textNodes[i];
        var nodeLen = node.textContent.length;
        if (curOffset + nodeLen > noteOffsets.start) {
          targetNode = node;
          targetNodeOffset = noteOffsets.start - curOffset;
          break;
        }
        curOffset += nodeLen;
      }

      if (!targetNode) continue;

      try {
        var marker = document.createElement('span');
        marker.className = 'anno-note-marker';
        marker.setAttribute('data-note-id', note.id);
        marker.setAttribute('title', note.text || 'Note');
        marker.setAttribute('style',
          'display: inline-block; width: 8px; height: 8px; background: #374151; border-radius: 50%; margin: 0 2px; vertical-align: middle; cursor: pointer; opacity: 0.7;');
        var range = document.createRange();
        range.setStart(targetNode, Math.min(targetNodeOffset, targetNode.textContent.length));
        range.collapse(true);
        range.insertNode(marker);
      } catch(e) {
        // Skip silently
      }
    }
  }

  // Initial render on load
  renderHighlights(currentHighlights);
  renderNotes(currentNotes);

  // Listen for dynamic updates from parent window
  window.addEventListener('message', function(e) {
    if (e.data?.type === 'annotation-update') {
      clearAnnotations();
      currentHighlights = e.data.highlights || [];
      currentNotes = e.data.notes || [];
      renderHighlights(currentHighlights);
      renderNotes(currentNotes);
    }
  });
})();
</script>`;
}

export function VerticalScroller({
  srcdoc,
  chapterIndex,
  chapterHref,
  title,
}: VerticalScrollerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const setScrollPosition = useBookStore((state) => state.setScrollPosition);

  // Get annotations for the current chapter - use useShallow to avoid infinite re-renders
  const highlights = useBookStore(
    useShallow((state) =>
      state.highlights.filter((h) => h.chapterHref === chapterHref),
    ),
  );
  const notes = useBookStore(
    useShallow((state) =>
      state.notes.filter((n) => n.chapterHref === chapterHref),
    ),
  );

  // Track whether we're restoring scroll (to avoid feedback loop)
  const isRestoringRef = useRef(false);
  // Track the chapter we last restored for
  const restoredChapterRef = useRef<string | null>(null);
  // Track if this is the initial render (to skip postMessage on mount)
  const isInitialRenderRef = useRef(true);

  /**
   * Handle scroll messages from the iframe.
   * Updates the Zustand store with the current scroll position.
   * Skips updates while restoring saved position.
   */
  const handleScrollMessage = useCallback(
    (event: MessageEvent) => {
      const data = event.data as ScrollMessage | undefined;
      if (!data || data.type !== "scroll-position") return;

      // Skip store updates during scroll restoration
      if (isRestoringRef.current) return;

      setScrollPosition(data.scrollY);
    },
    [setScrollPosition],
  );

  // Listen for postMessage from the iframe
  useEffect(() => {
    window.addEventListener("message", handleScrollMessage);
    return () => window.removeEventListener("message", handleScrollMessage);
  }, [handleScrollMessage]);

  /**
   * Restore scroll position after iframe loads.
   * When a chapter with saved progress loads, scroll to the saved position.
   */
  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    // Only restore if we have a saved position and haven't restored for this chapter yet
    const savedPosition = useBookStore.getState().ui.scrollPosition;
    if (savedPosition > 0 && restoredChapterRef.current !== chapterHref) {
      isRestoringRef.current = true;
      restoredChapterRef.current = chapterHref;

      // Small delay to let iframe content fully render and calculate layout
      requestAnimationFrame(() => {
        iframe.contentWindow?.scrollTo({
          top: savedPosition,
          behavior: "auto", // Instant for restoration, not smooth
        });

        // Re-enable scroll tracking after restoration
        setTimeout(() => {
          isRestoringRef.current = false;
        }, 100);
      });
    } else {
      // New chapter without saved position — scroll to top
      restoredChapterRef.current = chapterHref;
    }
  }, [chapterHref]);

  /**
   * Reset restoration tracking when chapter changes.
   * This ensures we attempt restoration for the new chapter.
   */
  useEffect(() => {
    restoredChapterRef.current = null;
  }, [chapterIndex]);

  /**
   * Send annotation updates to iframe via postMessage.
   * Skips the initial render since srcdoc already contains the initial annotations.
   * This avoids rebuilding srcdoc (which would reload the iframe).
   */
  useEffect(() => {
    // Skip the initial render - annotations are already in srcdoc
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      return;
    }

    const iframe = iframeRef.current?.contentWindow;
    if (!iframe) return;

    iframe.postMessage(
      {
        type: "annotation-update",
        highlights: highlights.map((h) => ({
          id: h.id,
          cfiRange: h.cfiRange,
          color: h.color,
        })),
        notes: notes.map((n) => ({
          id: n.id,
          cfiRange: n.cfiRange,
          text: n.text,
        })),
      },
      "*",
    );
  }, [highlights, notes]);

  // Build the final srcdoc with scroll tracker, selection detector, and annotations injected
  const annotationScript = useMemo(
    () =>
      buildAnnotationScript(
        highlights.map((h) => ({ id: h.id, cfiRange: h.cfiRange, color: h.color })),
        notes.map((n) => ({ id: n.id, cfiRange: n.cfiRange, text: n.text })),
      ),
    [highlights, notes],
  );

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


