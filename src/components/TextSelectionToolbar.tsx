/**
 * TextSelectionToolbar component.
 *
 * Floating toolbar that appears when text is selected in the EPUB chapter iframe.
 * Provides actions for creating notes and highlights from the selection.
 *
 * Communicates with the iframe via postMessage: the iframe's injected
 * selection detector script posts `text-selection` messages when the user
 * selects text, and this component listens for them.
 *
 * @example
 * ```tsx
 * <TextSelectionToolbar
 *   containerRef={iframeContainerRef}
 *   chapterHref="Text/chapter1.xhtml"
 * />
 * ```
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useBookStore } from "@/stores/useBookStore";
import { createNote, createHighlight } from "@/lib/annotations";
import { generateCfiRange, type SelectionMessage } from "@/lib/selection";
import { Button, TextArea, Icon } from "@/components/primitives";

interface TextSelectionToolbarProps {
  /** Ref to the iframe container element (for coordinate calculation) */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Current chapter href (for annotation association) */
  chapterHref: string;
}

/** Selection state tracked from iframe messages */
interface SelectionState {
  text: string;
  rect: {
    top: number;
    left: number;
    bottom: number;
    right: number;
    width: number;
    height: number;
  };
  startOffset: number;
  endOffset: number;
}

/** Available highlight colors */
const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#fde68a" },
  { name: "Green", value: "#a7f3d0" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Orange", value: "#fed7aa" },
] as const;

type ToolbarMode = "default" | "note" | "highlight";

export function TextSelectionToolbar({
  containerRef,
  chapterHref,
}: TextSelectionToolbarProps) {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [mode, setMode] = useState<ToolbarMode>("default");
  const [noteText, setNoteText] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const currentBook = useBookStore((state) => state.currentBook);

  /**
   * Listen for text-selection messages from the iframe.
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;

      if (data?.type === "text-selection") {
        const msg = data as SelectionMessage;
        setSelection({
          text: msg.text,
          rect: msg.rect,
          startOffset: msg.startOffset,
          endOffset: msg.endOffset,
        });
        setMode("default");
        setNoteText("");
      } else if (data?.type === "text-selection-cleared") {
        // Small delay to allow toolbar clicks to register before clearing
        setTimeout(() => {
          setSelection(null);
          setMode("default");
          setNoteText("");
        }, 150);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  /**
   * Dismiss toolbar on Escape key.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelection(null);
        setMode("default");
        setNoteText("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /**
   * Handle "Add Note" action — show note input.
   */
  const handleAddNote = useCallback(() => {
    setMode("note");
    setNoteText("");
  }, []);

  /**
   * Handle "Highlight" action — show color picker.
   */
  const handleHighlight = useCallback(() => {
    setMode("highlight");
  }, []);

  /**
   * Create a highlight with the selected color.
   */
  const handleCreateHighlight = useCallback(
    async (color: string) => {
      if (!selection || !currentBook) return;

      setIsCreating(true);
      try {
        const cfiRange = generateCfiRange(
          chapterHref,
          selection.startOffset,
          selection.endOffset,
        );
        await createHighlight(
          currentBook.id,
          chapterHref,
          cfiRange,
          selection.text,
          color,
        );
        setSelection(null);
        setMode("default");
      } catch (err) {
        console.error("Failed to create highlight:", err);
      } finally {
        setIsCreating(false);
      }
    },
    [selection, currentBook, chapterHref],
  );

  /**
   * Submit the note with user's content.
   */
  const handleSubmitNote = useCallback(async () => {
    if (!selection || !currentBook || !noteText.trim()) return;

    setIsCreating(true);
    try {
      const cfiRange = generateCfiRange(
        chapterHref,
        selection.startOffset,
        selection.endOffset,
      );
      await createNote(
        currentBook.id,
        chapterHref,
        cfiRange,
        selection.text,
        noteText.trim(),
      );
      setSelection(null);
      setMode("default");
      setNoteText("");
    } catch (err) {
      console.error("Failed to create note:", err);
    } finally {
      setIsCreating(false);
    }
  }, [selection, currentBook, chapterHref, noteText]);

  /**
   * Cancel and dismiss everything.
   */
  const handleCancel = useCallback(() => {
    setSelection(null);
    setMode("default");
    setNoteText("");
  }, []);

  /**
   * Calculate toolbar position relative to the container.
   * Positions the toolbar above the selection, centered horizontally.
   */
  const getToolbarPosition = useCallback((): React.CSSProperties => {
    if (!selection || !containerRef.current) return { display: "none" };

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    // The selection rect is relative to the iframe viewport.
    // The iframe fills the container, so the rect values map to container coordinates.
    const selRect = selection.rect;

    // Center toolbar horizontally on the selection
    const toolbarWidth = mode === "note" ? 320 : mode === "highlight" ? 260 : 220;
    let left = selRect.left + selRect.width / 2 - toolbarWidth / 2;

    // Clamp to container bounds
    const padding = 8;
    left = Math.max(padding, Math.min(left, containerRect.width - toolbarWidth - padding));

    // Position above the selection
    let top = selRect.top +24;

    // If toolbar would go above the container, position below selection instead
    const toolbarHeight = mode === "note" ? 160 : 60;
    if (top - toolbarHeight < 0) {
      top = selRect.bottom + 8;
    }

    return {
      position: "absolute",
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 100,
    };
  }, [selection, containerRef, mode]);

  if (!selection) return null;

  return (
    <div ref={toolbarRef} style={getToolbarPosition()}>
      <div className="bg-surface border border-border rounded-lg shadow-lg overflow-hidden min-w-[200px]">
        {mode === "default" && (
          <div className="flex items-center p-1">
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text bg-transparent border-none rounded cursor-pointer whitespace-nowrap font-sans hover:bg-bg transition-colors"
              onClick={handleAddNote}
              title="Add note to selection"
            >
              <Icon name="edit" size={14} className="shrink-0 opacity-70" />
              Note
            </button>
            <div className="w-px h-5 bg-border mx-0.5" />
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text bg-transparent border-none rounded cursor-pointer whitespace-nowrap font-sans hover:bg-bg transition-colors"
              onClick={handleHighlight}
              title="Highlight selection"
            >
              <Icon name="highlight" size={14} className="shrink-0 opacity-70" />
              Highlight
            </button>
          </div>
        )}

        {mode === "note" && (
          <div className="p-2 flex flex-col gap-2 min-w-[280px]">
            <TextArea
              placeholder="Write your note..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onSubmit={handleSubmitNote}
              onCancel={handleCancel}
              rows={3}
            />
            <div className="flex justify-end gap-1.5">
              <Button variant="secondary" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmitNote}
                disabled={isCreating || !noteText.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        )}

        {mode === "highlight" && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.value}
                className="w-6 h-6 rounded-full border-2 border-border cursor-pointer p-0 hover:scale-110 transition-transform"
                style={{ backgroundColor: color.value }}
                onClick={() => handleCreateHighlight(color.value)}
                title={color.name}
                disabled={isCreating}
              />
            ))}
          </div>
        )}

        {/* Selection preview */}
        <div className="px-2.5 pt-1 pb-1.5 border-t border-border">
          <span className="text-[0.72rem] text-text-muted italic leading-[1.4] block overflow-hidden text-ellipsis whitespace-nowrap">
            {selection.text.length > 60
              ? selection.text.slice(0, 60) + "..."
              : selection.text}
          </span>
        </div>
      </div>
    </div>
  );
}
