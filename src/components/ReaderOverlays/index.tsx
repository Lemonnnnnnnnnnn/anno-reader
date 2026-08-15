/**
 * ReaderOverlays component.
 *
 * Shared floating-UI cluster for reader surfaces (EPUB iframe and PDF
 * canvas/text-layer). Communicates via window postMessage messages:
 *
 * Inbound (from the content surface):
 * - "text-selection" / "text-selection-cleared" → selection toolbar
 * - "note-click" { noteId, rect } → note detail drawer
 * - "highlight-click" { highlightId, rect } → highlight popover
 * - "close-popovers" → dismiss popovers
 *
 * Outbound (via TextSelectionToolbar): annotation creation through the
 * annotations module using the current chapterHref.
 *
 * Extracted from VerticalScroller so PDF pages get identical selection,
 * annotation, and translation UX without an iframe.
 */

import { useEffect, useState, useCallback } from "react";
import { useBookStore } from "@/stores/useBookStore";
import { updateHighlight, deleteHighlight } from "@/lib/annotations";
import { generateCfiRange } from "@/lib/selection";
import { TextSelectionToolbar } from "../TextSelectionToolbar";
import { AnnotationDetailDrawer } from "../AnnotationDetailDrawer";
import { HighlightPopover } from "../HighlightPopover";
import { AITranslationPanel } from "../AITranslationPanel";

interface ReaderOverlaysProps {
  /** Container the overlays are positioned against (the content surface). */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Current chapter/page href — scopes annotations and progress. */
  chapterHref: string;
  /** Plain text of the current chapter/page (AI translation context). */
  chapterText: string | null;
  /** Callback when user clicks "Ask AI" in selection toolbar. */
  onAskAI?: (selectedText: string) => void;
}

export function ReaderOverlays({
  containerRef,
  chapterHref,
  chapterText,
  onAskAI,
}: ReaderOverlaysProps) {
  // Annotation popover state
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // Highlight popover state
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [highlightPosition, setHighlightPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // Dismiss popovers on chapter/page navigation
  useEffect(() => {
    setActiveNoteId(null);
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

  // Listen for note-click / highlight-click / close-popovers messages
  // from the content surface (iframe script or PDF text layer).
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
      if (event.data?.type === "close-popovers") {
        // Close all popovers when clicking on empty area
        setActiveNoteId(null);
        setActiveHighlightId(null);
        setHighlightPosition(null);
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

  const handleHighlightColorChange = useCallback(
    (color: string) => {
      if (!activeHighlightId || !currentBook) return;
      updateHighlight(activeHighlightId, { color }, currentBook.id);
    },
    [activeHighlightId, currentBook],
  );

  const handleHighlightDelete = useCallback(() => {
    if (!activeHighlightId || !currentBook) return;
    deleteHighlight(activeHighlightId, currentBook.id);
    setActiveHighlightId(null);
    setHighlightPosition(null);
  }, [activeHighlightId, currentBook]);

  const handleTranslate = useCallback(
    (data: {
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
    },
    [],
  );

  const handleCloseTranslationPanel = useCallback(() => {
    setTranslationPanel(null);
  }, []);

  return (
    <>
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
      {translationPanel && (
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
          sentence={translationPanel?.sentence}
          isOpen={!!translationPanel}
          onClose={handleCloseTranslationPanel}
        />
      )}
    </>
  );
}
