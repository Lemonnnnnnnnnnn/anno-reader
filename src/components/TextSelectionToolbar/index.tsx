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

import { useRef } from "react";
import { Button, TextArea, Icon } from "@/components/primitives";
import { HIGHLIGHT_COLORS } from "./constants";
import {
  useSelectionListener,
  useToolbarActions,
  useToolbarPosition,
} from "./hooks";

interface TextSelectionToolbarProps {
  /** Ref to the iframe container element (for coordinate calculation) */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Current chapter href (for annotation association) */
  chapterHref: string;
}

export function TextSelectionToolbar({
  containerRef,
  chapterHref,
}: TextSelectionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  const {
    selection,
    mode,
    setMode,
    noteText,
    setNoteText,
    resetSelection,
  } = useSelectionListener();

  const {
    isCreating,
    handleAddNote,
    handleHighlight,
    handleCreateHighlight,
    handleSubmitNote,
    handleCancel,
  } = useToolbarActions({
    selection,
    chapterHref,
    setMode,
    noteText,
    setNoteText,
    resetSelection,
  });

  const { getToolbarPosition } = useToolbarPosition({
    selection,
    containerRef,
    mode,
  });

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
