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
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

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
   * Focus note input when switching to note mode.
   */
  useEffect(() => {
    if (mode === "note" && noteInputRef.current) {
      noteInputRef.current.focus();
    }
  }, [mode]);

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
    let top = selRect.top - 8;

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
      <div style={styles.toolbar}>
        {mode === "default" && (
          <div style={styles.buttonRow}>
            <button
              style={styles.actionButton}
              onClick={handleAddNote}
              title="Add note to selection"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={styles.buttonIcon}
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Note
            </button>
            <div style={styles.divider} />
            <button
              style={styles.actionButton}
              onClick={handleHighlight}
              title="Highlight selection"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={styles.buttonIcon}
              >
                <path d="m9 11-6 6v3h9l3-3" />
                <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
              </svg>
              Highlight
            </button>
          </div>
        )}

        {mode === "note" && (
          <div style={styles.noteContainer}>
            <textarea
              ref={noteInputRef}
              style={styles.noteInput}
              placeholder="Write your note..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmitNote();
                }
              }}
              rows={3}
            />
            <div style={styles.noteActions}>
              <button
                style={styles.cancelButton}
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                style={{
                  ...styles.submitButton,
                  ...(isCreating || !noteText.trim()
                    ? styles.submitButtonDisabled
                    : {}),
                }}
                onClick={handleSubmitNote}
                disabled={isCreating || !noteText.trim()}
              >
                Save
              </button>
            </div>
          </div>
        )}

        {mode === "highlight" && (
          <div style={styles.colorPicker}>
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.value}
                style={{
                  ...styles.colorSwatch,
                  background: color.value,
                }}
                onClick={() => handleCreateHighlight(color.value)}
                title={color.name}
                disabled={isCreating}
              />
            ))}
          </div>
        )}

        {/* Selection preview */}
        <div style={styles.selectionPreview}>
          <span style={styles.previewText}>
            {selection.text.length > 60
              ? selection.text.slice(0, 60) + "..."
              : selection.text}
          </span>
        </div>
      </div>
    </div>
  );
}

// --- Design tokens (matching project conventions) ---

const colors = {
  surface: "#ffffff",
  surfaceHover: "#f9fafb",
  text: "#0f0f0f",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  border: "#e5e5e5",
  accent: "#374151",
  accentHover: "#1f2937",
  shadow: "rgba(0, 0, 0, 0.08)",
  shadowStrong: "rgba(0, 0, 0, 0.15)",
} as const;

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: "8px",
    boxShadow: `0 4px 16px ${colors.shadow}, 0 2px 4px ${colors.shadow}`,
    overflow: "hidden",
    minWidth: "200px",
  },
  buttonRow: {
    display: "flex",
    alignItems: "center",
    padding: "4px",
  },
  actionButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 12px",
    fontSize: "0.8rem",
    fontWeight: 500,
    color: colors.text,
    background: "transparent",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    transition: "background 0.12s, color 0.12s",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  buttonIcon: {
    flexShrink: 0,
    opacity: 0.7,
  },
  divider: {
    width: "1px",
    height: "20px",
    background: colors.border,
    margin: "0 2px",
  },
  noteContainer: {
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: "280px",
  },
  noteInput: {
    width: "100%",
    padding: "8px 10px",
    fontSize: "0.825rem",
    fontFamily: "inherit",
    lineHeight: "1.5",
    color: colors.text,
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: "5px",
    resize: "vertical",
    outline: "none",
    transition: "border-color 0.15s",
    minHeight: "60px",
    boxSizing: "border-box",
  },
  noteActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "6px",
  },
  cancelButton: {
    padding: "5px 12px",
    fontSize: "0.78rem",
    fontWeight: 500,
    color: colors.textSecondary,
    background: "transparent",
    border: `1px solid ${colors.border}`,
    borderRadius: "5px",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.12s",
  },
  submitButton: {
    padding: "5px 14px",
    fontSize: "0.78rem",
    fontWeight: 500,
    color: colors.surface,
    background: colors.accent,
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.12s, opacity 0.12s",
  },
  submitButtonDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  colorPicker: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 10px",
  },
  colorSwatch: {
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    border: `2px solid ${colors.border}`,
    cursor: "pointer",
    transition: "transform 0.12s, border-color 0.12s",
    padding: 0,
    outline: "none",
  },
  selectionPreview: {
    padding: "4px 10px 6px",
    borderTop: `1px solid ${colors.border}`,
  },
  previewText: {
    fontSize: "0.72rem",
    color: colors.textMuted,
    fontStyle: "italic",
    lineHeight: "1.4",
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};
