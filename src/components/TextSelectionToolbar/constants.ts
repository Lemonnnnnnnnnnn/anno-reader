/**
 * TextSelectionToolbar constants and types.
 */

/** Selection state tracked from iframe messages */
export interface SelectionState {
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
  /** The sentence containing the selection (for AI context) */
  sentence?: string;
  /** The paragraph containing the selection (for AI context) */
  paragraph?: string;
}

/** Available highlight colors */
export const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#fde68a" },
  { name: "Green", value: "#a7f3d0" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Orange", value: "#fed7aa" },
] as const;

export type ToolbarMode = "default" | "note" | "highlight";
