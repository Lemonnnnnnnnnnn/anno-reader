/**
 * Selection listener hook for TextSelectionToolbar.
 *
 * Handles:
 * - Listening for text-selection messages from iframe
 * - Dismiss toolbar on Escape key
 * - Managing selection state
 */

import { useState, useEffect } from "react";
import { type SelectionMessage } from "@/lib/selection";
import type { SelectionState, ToolbarMode } from "../constants";

export function useSelectionListener() {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [mode, setMode] = useState<ToolbarMode>("default");
  const [noteText, setNoteText] = useState("");

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
      } else if (data?.type === "highlight-click") {
        // Dismiss text selection toolbar when a highlight is clicked
        setSelection(null);
        setMode("default");
        setNoteText("");
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

  const resetSelection = () => {
    setSelection(null);
    setMode("default");
    setNoteText("");
  };

  return {
    selection,
    setSelection,
    mode,
    setMode,
    noteText,
    setNoteText,
    resetSelection,
  };
}
