/**
 * usePdfSelection hook.
 *
 * Bridges text selection on the PDF text layer to the shared postMessage
 * contract consumed by TextSelectionToolbar ("text-selection" /
 * "text-selection-cleared"), with container-relative rects and
 * line-based sentence/paragraph context for AI features.
 *
 * Mirrors the injected iframe script in lib/selection.ts, adapted for the
 * main document:
 * - mouseup listens at document level, so finishing a drag outside the
 *   page (e.g. in the margin) still reports the selection
 * - mousedown anywhere (except the floating toolbar) clears the toolbar,
 *   matching the iframe behavior where every in-iframe mousedown clears
 */

import { useEffect } from "react";
import {
  getTextOffset,
  toContainerRect,
  findSentenceContext,
  findParagraphContext,
  isInsideFloatingUi,
} from "../textLayerDom";

interface UsePdfSelectionParams {
  textLayerRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Increments after each completed page render (listener rebind). */
  renderEpoch: number;
  /** Text lines of the rendered page (selection context). */
  pageLines: readonly string[];
}

export function usePdfSelection({
  textLayerRef,
  containerRef,
  renderEpoch,
  pageLines,
}: UsePdfSelectionParams) {
  useEffect(() => {
    const root = textLayerRef.current;
    if (!root || renderEpoch === 0) return;

    const postSelection = () => {
      const container = containerRef.current;
      if (!container) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

      const text = sel.toString().trim();
      if (!text) return;

      // Selection must lie within the text layer to be a PDF selection
      const range = sel.getRangeAt(0);
      if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
        return;
      }

      const rect = range.getBoundingClientRect();
      const startOffset = getTextOffset(
        root,
        range.startContainer,
        range.startOffset,
      );
      const endOffset = getTextOffset(root, range.endContainer, range.endOffset);

      window.postMessage(
        {
          type: "text-selection",
          text,
          rect: toContainerRect(rect, container),
          startOffset,
          endOffset,
          sentence: findSentenceContext(text, pageLines),
          paragraph: findParagraphContext(text, pageLines),
        },
        "*",
      );
    };

    // Gesture-source tracking (Chrome-like semantics): the selection is
    // only reported when the interaction STARTED on the text layer.
    // Clicks on UI (toolbar, drawers, zoom buttons) never re-report the
    // still-active browser selection — without this, the delayed mouseup
    // post would re-open the toolbar right after the click handler closed
    // it (e.g. AI translate: closes, then reopens a moment later).
    const mouseDownOnLayerRef = { current: false };

    const handleMouseUp = () => {
      if (!mouseDownOnLayerRef.current) return;
      // Small delay lets the browser finalize the selection
      window.setTimeout(postSelection, 10);
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Clicks on the floating toolbar must not dismiss it (and are
      // never treated as page gestures)
      if (isInsideFloatingUi(e.target)) {
        mouseDownOnLayerRef.current = false;
        return;
      }

      const onLayer = root.contains(e.target as Node | null);
      mouseDownOnLayerRef.current = onLayer;

      // Clicking anywhere else (margin, drawers, zoom controls) dismisses
      // a stale selection toolbar; a new page gesture replaces it on mouseup
      if (!onLayer) {
        window.postMessage({ type: "text-selection-cleared" }, "*");
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [textLayerRef, containerRef, renderEpoch, pageLines]);

  // A rebuilt text layer (page change / zoom) invalidates any current
  // selection — dismiss a lingering toolbar.
  useEffect(() => {
    if (renderEpoch === 0) return;
    window.postMessage({ type: "text-selection-cleared" }, "*");
  }, [renderEpoch]);
}
