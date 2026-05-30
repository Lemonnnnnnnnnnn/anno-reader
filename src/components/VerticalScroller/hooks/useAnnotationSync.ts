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

  function wrapRange(startOffset, endOffset, className, style, dataAttrs) {
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
      if (dataAttrs) {
        for (var key in dataAttrs) {
          if (dataAttrs.hasOwnProperty(key)) {
            span.setAttribute('data-' + key, dataAttrs[key]);
          }
        }
      }
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

    // Remove note underline spans (unwrap them, keeping text content)
    var noteSpans = document.querySelectorAll('.anno-note');
    noteSpans.forEach(function(span) {
      var parent = span.parentNode;
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
        'background-color: ' + hl.color + '; border-radius: 2px; padding: 1px 0;');
    }
  }

  function renderNotes(notes) {
    for (var n = 0; n < notes.length; n++) {
      var note = notes[n];
      var noteOffsets = parseCfiOffsets(note.cfiRange);
      if (!noteOffsets) continue;

      wrapRange(noteOffsets.start, noteOffsets.end, 'anno-note',
        'text-decoration: underline dotted; text-underline-offset: 3px; cursor: pointer;',
        { 'note-id': note.id });

      // Add click handler to the newly created span
      var noteSpans = document.querySelectorAll('.anno-note[data-note-id="' + note.id + '"]');
      noteSpans.forEach(function(span) {
        span.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          var rect = span.getBoundingClientRect();
          window.parent.postMessage({
            type: 'note-click',
            noteId: note.id,
            rect: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
          }, '*');
        });
      });
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

// ---------------------------------------------------------------------------
// useAnnotationSync hook
// ---------------------------------------------------------------------------

export function useAnnotationSync(
  chapterHref: string,
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
) {
  // Track if this is the initial render (to skip postMessage on mount)
  const isInitialRenderRef = useRef(true);

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

  // Build annotation script for initial srcdoc injection
  const annotationScript = useMemo(
    () =>
      buildAnnotationScript(
        highlights.map((h) => ({ id: h.id, cfiRange: h.cfiRange, color: h.color })),
        notes.map((n) => ({ id: n.id, cfiRange: n.cfiRange, text: n.text })),
      ),
    [highlights, notes],
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
