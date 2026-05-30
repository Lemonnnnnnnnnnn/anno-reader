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
