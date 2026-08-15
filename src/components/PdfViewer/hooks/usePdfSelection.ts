/**
 * usePdfSelection hook.
 *
 * Bridges text selection on the PDF text layer to the shared postMessage
 * contract consumed by TextSelectionToolbar ("text-selection" /
 * "text-selection-cleared"), with container-relative rects and
 * line-based sentence/paragraph context for AI features.
 *
 * Mirrors the injected iframe script in lib/selection.ts.
 */

import { useEffect } from "react";
import {
  getTextOffset,
  toContainerRect,
  findSentenceContext,
  findParagraphContext,
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

      // Selection must intersect the text layer to be a PDF selection
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return;

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

    const postClear = () => {
      window.setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          window.postMessage({ type: "text-selection-cleared" }, "*");
        }
      }, 200);
    };

    const handleMouseUp = () => {
      // Small delay lets the browser finalize the selection
      window.setTimeout(postSelection, 10);
    };

    root.addEventListener("mouseup", handleMouseUp);
    root.addEventListener("mousedown", postClear);
    return () => {
      root.removeEventListener("mouseup", handleMouseUp);
      root.removeEventListener("mousedown", postClear);
    };
  }, [textLayerRef, containerRef, renderEpoch, pageLines]);
}
