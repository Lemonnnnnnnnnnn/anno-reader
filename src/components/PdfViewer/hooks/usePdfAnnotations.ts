/**
 * usePdfAnnotations hook.
 *
 * Renders highlights and notes as overlays on the PDF text layer and
 * bridges clicks to the shared postMessage contract consumed by
 * ReaderOverlays ("highlight-click", "note-click", "close-popovers").
 *
 * Re-applies overlays whenever the text layer is rebuilt (renderEpoch)
 * or the store's annotations for the current chapter change.
 */

import { useEffect } from "react";
import { useBookStore } from "@/stores/useBookStore";
import { useShallow } from "zustand/shallow";
import { clearAnnotations, wrapRange, parseCfiOffsets, toContainerRect } from "../textLayerDom";

interface UsePdfAnnotationsParams {
  textLayerRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Increments after each completed page render (text layer rebuilt). */
  renderEpoch: number;
  /** Current chapter (page) href. */
  chapterHref: string;
}

export function usePdfAnnotations({
  textLayerRef,
  containerRef,
  renderEpoch,
  chapterHref,
}: UsePdfAnnotationsParams) {
  // Annotations for the current chapter — useShallow prevents re-render loops
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

  // Re-render overlays after page render or annotation changes
  useEffect(() => {
    const root = textLayerRef.current;
    if (!root || renderEpoch === 0) return;

    clearAnnotations(root);

    for (const hl of highlights) {
      const offsets = parseCfiOffsets(hl.cfiRange);
      if (!offsets) continue;
      // The pdf.js span text is transparent (canvas glyphs show through);
      // keep that for the wrapped highlight text in both themes so the
      // canvas-rendered glyph (inverted in dark mode) stays visible.
      wrapRange(
        root,
        offsets.start,
        offsets.end,
        "anno-highlight",
        `background-color: ${hl.color}; color: inherit;`,
        { "highlight-id": hl.id },
      );
    }

    for (const note of notes) {
      const offsets = parseCfiOffsets(note.cfiRange);
      if (!offsets) continue;
      wrapRange(
        root,
        offsets.start,
        offsets.end,
        "anno-note",
        null,
        { "note-id": note.id },
      );
    }
  }, [textLayerRef, renderEpoch, highlights, notes]);

  // Delegated click bridge (listener survives text layer rebuilds)
  useEffect(() => {
    const root = textLayerRef.current;
    const container = containerRef.current;
    if (!root || !container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const highlightSpan = target.closest<HTMLElement>(".anno-highlight");
      if (highlightSpan) {
        e.preventDefault();
        const rect = highlightSpan.getBoundingClientRect();
        window.postMessage(
          {
            type: "highlight-click",
            highlightId: highlightSpan.dataset.highlightId,
            rect: toContainerRect(rect, container),
          },
          "*",
        );
        return;
      }

      const noteSpan = target.closest<HTMLElement>(".anno-note");
      if (noteSpan) {
        e.preventDefault();
        const rect = noteSpan.getBoundingClientRect();
        window.postMessage(
          {
            type: "note-click",
            noteId: noteSpan.dataset.noteId,
            rect: toContainerRect(rect, container),
          },
          "*",
        );
        return;
      }

      // Click on empty area (not on an annotation) closes popovers
      window.postMessage({ type: "close-popovers" }, "*");
    };

    root.addEventListener("click", handleClick);
    return () => root.removeEventListener("click", handleClick);
  }, [textLayerRef, containerRef]);
}
