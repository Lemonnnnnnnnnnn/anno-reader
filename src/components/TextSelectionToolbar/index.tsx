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
import { Button, TextArea } from "@/components/primitives";
import { Pencil, Highlighter, Languages, Bot, Volume2 } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import { useTTSConfigStore } from "@/stores/useTTSConfigStore";
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
  /** Callback when user confirms translation — receives selection data for AITranslationPanel */
  onTranslate?: (
    data: {
      selectedText: string;
      chapterHref: string;
      startOffset: number;
      endOffset: number;
      sentence?: string;
      paragraph?: string;
    },
  ) => void;
  /** Callback when user clicks "Ask AI" — receives selected text for ChatDrawer */
  onAskAI?: (selectedText: string) => void;
}

export function TextSelectionToolbar({
  containerRef,
  chapterHref,
  onTranslate,
  onAskAI,
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

  const ttsConfig = useTTSConfigStore((s) => s.config);
  const isTTSAvailable = Boolean(ttsConfig.selectedProviderId);
  const { speak, isSpeaking } = useTTS(selection?.text ?? "");

  if (!selection) return null;

  return (
    <div ref={toolbarRef} style={getToolbarPosition()}>
      <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg shadow-lg overflow-hidden min-w-[200px]">
        {mode === "default" && (
          <div className="flex items-center p-1">
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text dark:text-text-dark bg-transparent border-none rounded cursor-pointer whitespace-nowrap font-sans hover:bg-bg dark:hover:bg-bg-dark transition-colors"
              onClick={handleAddNote}
              title="Add note to selection"
            >
              <Pencil size={14} className="shrink-0 opacity-70" />
              Note
            </button>
            <div className="w-px h-5 bg-border dark:bg-border-dark mx-0.5" />
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text dark:text-text-dark bg-transparent border-none rounded cursor-pointer whitespace-nowrap font-sans hover:bg-bg dark:hover:bg-bg-dark transition-colors"
              onClick={handleHighlight}
              title="Highlight selection"
            >
              <Highlighter size={14} className="shrink-0 opacity-70" />
              Highlight
            </button>
            <div className="w-px h-5 bg-border dark:bg-border-dark mx-0.5" />
            <button
              className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-text dark:text-text-dark bg-transparent border-none rounded cursor-pointer whitespace-nowrap font-sans hover:bg-bg dark:hover:bg-bg-dark transition-colors"
              onClick={() => {
                if (onTranslate && selection) {
                  onTranslate({
                    selectedText: selection.text,
                    chapterHref,
                    startOffset: selection.startOffset,
                    endOffset: selection.endOffset,
                    sentence: selection.sentence,
                    paragraph: selection.paragraph,
                  });
                  resetSelection();
                }
              }}
              title="Translate selection"
            >
              <Languages size={14} className="shrink-0 opacity-70" />
            </button>
            {isTTSAvailable && (
              <>
                <div className="w-px h-5 bg-border dark:bg-border-dark mx-0.5" />
                <button
                  className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-text dark:text-text-dark bg-transparent border-none rounded cursor-pointer whitespace-nowrap font-sans hover:bg-bg dark:hover:bg-bg-dark transition-colors"
                  onClick={() => speak()}
                  title={isSpeaking ? "Stop speaking" : "Listen to selection"}
                >
                  <Volume2 size={14} className={`shrink-0 ${isSpeaking ? "opacity-100" : "opacity-70"}`} />
                </button>
              </>
            )}
            {onAskAI && (
              <>
                <div className="w-px h-5 bg-border dark:bg-border-dark mx-0.5" />
                <button
                  className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-text dark:text-text-dark bg-transparent border-none rounded cursor-pointer whitespace-nowrap font-sans hover:bg-bg dark:hover:bg-bg-dark transition-colors"
                  onClick={() => {
                    if (onAskAI && selection) {
                      onAskAI(selection.text);
                      resetSelection();
                    }
                  }}
                  title="Ask AI about selection"
                >
                  <Bot size={14} className="shrink-0 opacity-70" />
                </button>
              </>
            )}
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
                className="w-6 h-6 rounded-full border-2 border-border dark:border-border-dark cursor-pointer p-0 hover:scale-110 transition-transform"
                style={{ backgroundColor: color.value }}
                onClick={() => handleCreateHighlight(color.value)}
                title={color.name}
                disabled={isCreating}
              />
            ))}
          </div>
        )}

        {/* Selection preview */}
        <div className="px-2.5 pt-1 pb-1.5 border-t border-border dark:border-border-dark">
          <span className="text-[0.72rem] text-text-muted dark:text-text-muted-dark italic leading-[1.4] block overflow-hidden text-ellipsis whitespace-nowrap">
            {selection.text.length > 60
              ? selection.text.slice(0, 60) + "..."
              : selection.text}
          </span>
        </div>
      </div>
    </div>
  );
}
