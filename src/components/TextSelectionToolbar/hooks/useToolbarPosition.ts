/**
 * Toolbar position hook for TextSelectionToolbar.
 *
 * Handles:
 * - Calculating toolbar position relative to container
 * - Positioning above selection, centered horizontally
 */

import { useCallback } from "react";
import type { SelectionState, ToolbarMode } from "../constants";

interface UseToolbarPositionParams {
  selection: SelectionState | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  mode: ToolbarMode;
}

export function useToolbarPosition({
  selection,
  containerRef,
  mode,
}: UseToolbarPositionParams) {
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

  return { getToolbarPosition };
}
