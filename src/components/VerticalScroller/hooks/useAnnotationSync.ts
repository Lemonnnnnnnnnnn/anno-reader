/**
 * Annotation synchronization hook for VerticalScroller.
 *
 * Handles:
 * - Getting annotation state from Zustand store
 * - Building annotation script for initial srcdoc injection
 * - Sending annotation updates to iframe via postMessage
 */

import { useEffect, useRef, useMemo } from "react";
import { useBookStore } from "@/stores/useBookStore";
import { useShallow } from "zustand/shallow";
import type { ContentRef } from "@/lib/content/types";

// ---------------------------------------------------------------------------
// Annotation script builder
// ---------------------------------------------------------------------------

/**
 * Build a script that renders highlights and note markers in the iframe.
 * Supports dynamic updates via postMessage to avoid iframe reload.
 *
 * The script:
 * 1. Renders initial annotations on load
 * 2. Listens for 'annotation-update' messages to update dynamically
 * 3. Provides clearAnnotations() to remove old annotations before re-rendering
 */
export function buildAnnotationScript(
  highlights: Array<{ id: string; cfiRange: string; color: string }>,
  notes: Array<{ id: string; cfiRange: string; text: string }>,
  theme: "light" | "dark" = "light",
): string {
  const highlightsJson = JSON.stringify(highlights);
  const notesJson = JSON.stringify(notes);

  return `
<script>
(function() {
  var currentHighlights = ${highlightsJson};
  var currentNotes = ${notesJson};
  var highlightTextColor = "${theme === "dark" ? "#1a1a1a" : "inherit"}";

  function parseCfiOffsets(cfi) {
    var match = cfi.match(/:(\\d+),(\\d+)\\)$/);
    if (!match) return null;
    return { start: parseInt(match[1], 10), end: parseInt(match[2], 10) };
  }

  function getTextNodes(root) {
    var nodes = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node) {
        var parent = node.parentElement;
        while (parent && parent !== root) {
          var tagName = parent.tagName ? parent.tagName.toLowerCase() : '';
          if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
            return NodeFilter.FILTER_REJECT;
          }
          parent = parent.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }, false);
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.length > 0) {
        nodes.push(walker.currentNode);
      }
    }
    return nodes;
  }

  function wrapRange(startOffset, endOffset, className, style, dataAttrs) {
    var body = document.body;
    var textNodes = getTextNodes(body);
    var currentOffset = 0;
    var startNode, startNodeOffset, endNode, endNodeOffset;

    // Calculate total text length for validation
    var totalTextLength = 0;
    for (var i = 0; i < textNodes.length; i++) {
      totalTextLength += textNodes[i].textContent.length;
    }

    // Validate offsets are within bounds
    if (startOffset < 0 || endOffset > totalTextLength || startOffset >= endOffset) {
      console.warn('Invalid offsets:', { startOffset, endOffset, totalTextLength });
      return;
    }

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
    if (!startNode || !endNode) {
      console.warn('Could not find start/end nodes for offsets:', { startOffset, endOffset });
      return;
    }

    try {
      function createAnnotationSpan() {
        var span = document.createElement('span');
        span.className = className;
        if (style) span.setAttribute('style', style);
        if (dataAttrs) {
          for (var key in dataAttrs) {
            if (dataAttrs.hasOwnProperty(key)) {
              span.setAttribute('data-' + key, dataAttrs[key]);
            }
          }
        }
        return span;
      }

      // Wrap each affected text node independently. This avoids moving or
      // cloning element ancestors when an annotation crosses tag boundaries.
      for (var j = textNodes.indexOf(endNode); j >= textNodes.indexOf(startNode); j--) {
        var textNode = textNodes[j];
        var from = textNode === startNode ? startNodeOffset : 0;
        var to = textNode === endNode ? endNodeOffset : textNode.textContent.length;
        if (from >= to) continue;

        var range = document.createRange();
        range.setStart(textNode, from);
        range.setEnd(textNode, to);
        range.surroundContents(createAnnotationSpan());
      }
    } catch(e) {
      // Range wrapping can fail on complex selections
      console.warn('Failed to wrap range for annotation:', {
        error: e.message,
        startOffset: startOffset,
        endOffset: endOffset,
        startNode: startNode,
        endNode: endNode
      });
    }
  }

  function clearAnnotations() {
    // Remove highlight spans (unwrap them, keeping text content)
    var spans = document.querySelectorAll('.anno-highlight, .anno-note');
    Array.prototype.slice.call(spans).reverse().forEach(function(span) {
      var parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
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
        'background-color: ' + hl.color + '; color: ' + highlightTextColor + '; border-radius: 2px; padding: 1px 0;',
        { 'highlight-id': hl.id });

      // Add click handler to the newly created span
      // Use IIFE to capture highlightId in closure
      (function(highlightId) {
        var highlightSpans = document.querySelectorAll('.anno-highlight[data-highlight-id="' + highlightId + '"]');
        highlightSpans.forEach(function(span) {
          span.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var rect = span.getBoundingClientRect();
            window.parent.postMessage({
              type: 'highlight-click',
              highlightId: highlightId,
              rect: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
            }, '*');
          });
        });
      })(hl.id);
    }
  }

  function renderNotes(notes) {
    for (var n = 0; n < notes.length; n++) {
      var note = notes[n];
      var noteOffsets = parseCfiOffsets(note.cfiRange);
      if (!noteOffsets) {
        console.warn('Failed to parse CFI for note:', note.id, 'cfiRange:', note.cfiRange);
        continue;
      }

      wrapRange(noteOffsets.start, noteOffsets.end, 'anno-note',
        'text-decoration: underline dotted; text-underline-offset: 3px; cursor: pointer;',
        { 'note-id': note.id });

      // Add click handler to the newly created span
      // Use IIFE to capture noteId in closure
      (function(noteId) {
        var noteSpans = document.querySelectorAll('.anno-note[data-note-id="' + noteId + '"]');
        noteSpans.forEach(function(span) {
          span.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var rect = span.getBoundingClientRect();
            window.parent.postMessage({
              type: 'note-click',
              noteId: noteId,
              rect: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
            }, '*');
          });
        });
      })(note.id);
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

  // Close popovers when clicking on empty area (not on highlight or note)
  document.addEventListener('click', function(e) {
    var target = e.target;
    if (target && !target.closest('.anno-highlight') && !target.closest('.anno-note')) {
      window.parent.postMessage({ type: 'close-popovers' }, '*');
    }
  });
})();
</script>`;
}

// ---------------------------------------------------------------------------
// useAnnotationSync hook
// ---------------------------------------------------------------------------

export function useAnnotationSync(
  contentRef: ContentRef,
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
) {
  const sourceId = contentRef.sourceId;
  // Track if this is the initial render (to skip postMessage on mount)
  const isInitialRenderRef = useRef(true);

  // Get annotations for the current chapter - use useShallow to avoid infinite re-renders
  const highlights = useBookStore(
    useShallow((state) =>
      state.highlights.filter((h) => h.chapterHref === sourceId),
    ),
  );
  const notes = useBookStore(
    useShallow((state) =>
      state.notes.filter((n) => n.chapterHref === sourceId),
    ),
  );
  const theme = useBookStore((state) => state.ui.theme);

  // Build annotation script for initial srcdoc injection
  const annotationScript = useMemo(
    () =>
      buildAnnotationScript(
        highlights.map((h) => ({ id: h.id, cfiRange: h.cfiRange, color: h.color })),
        notes.map((n) => ({ id: n.id, cfiRange: n.cfiRange, text: n.text })),
        theme,
      ),
    [highlights, notes, theme],
  );

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

  return { highlights, notes, annotationScript };
}
