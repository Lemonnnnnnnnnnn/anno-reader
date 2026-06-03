/**
 * HighlightPopover component.
 *
 * Lightweight floating popover for editing an existing highlight.
 * Shows 5 color swatches (from HIGHLIGHT_COLORS) and a delete button.
 * Positioned absolutely relative to the reader container.
 *
 * @example
 * ```tsx
 * <HighlightPopover
 *   highlight={highlight}
 *   position={{ top: 120, left: 300 }}
 *   onColorChange={(color) => updateHighlight(highlight.id, { color })}
 *   onDelete={() => deleteHighlight(highlight.id)}
 *   onClose={() => setActiveHighlight(null)}
 * />
 * ```
 */

import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { HIGHLIGHT_COLORS } from "@/components/TextSelectionToolbar/constants";
import type { Highlight } from "@/stores/useBookStore";

interface HighlightPopoverProps {
  /** The highlight being edited */
  highlight: Highlight;
  /** Absolute position for the popover (relative to container) */
  position: { top: number; left: number };
  /** Called when user selects a new color */
  onColorChange: (color: string) => void;
  /** Called when user clicks delete */
  onDelete: () => void;
  /** Called when popover should close (click outside) */
  onClose: () => void;
}

export function HighlightPopover({
  highlight,
  position,
  onColorChange,
  onDelete,
  onClose,
}: HighlightPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Dismiss on click outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="absolute z-50"
      style={{
        position: "absolute",
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg shadow-lg overflow-hidden">
        {/* Color swatches */}
        <div className="flex items-center gap-1.5 px-2.5 py-2">
          {HIGHLIGHT_COLORS.map((color) => {
            const isActive = highlight.color === color.value;
            return (
              <button
                key={color.value}
                data-color-swatch
                className={`w-6 h-6 rounded-full border-2 cursor-pointer p-0 hover:scale-110 transition-transform ${
                  isActive
                    ? "ring-2 ring-accent dark:ring-accent-dark ring-offset-1 border-accent dark:border-accent-dark"
                    : "border-border dark:border-border-dark"
                }`}
                style={{ backgroundColor: color.value }}
                onClick={() => onColorChange(color.value)}
                title={color.name}
              />
            );
          })}
        </div>

        {/* Divider */}
        <div className="h-px bg-border dark:bg-border-dark mx-2" />

        {/* Delete button */}
        <div className="px-2.5 py-1.5">
          <button
            data-delete
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-error bg-transparent border-none rounded cursor-pointer font-sans hover:bg-error-bg dark:hover:bg-error-bg-dark transition-colors w-full justify-center"
            onClick={onDelete}
          >
            <Trash2 size={13} className="shrink-0" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
