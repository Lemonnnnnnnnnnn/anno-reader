/**
 * FontSizePopover component.
 *
 * Floating popover for adjusting reader font size.
 * Shows current size with +/- controls and preset quick buttons.
 * Positioned fixed relative to the viewport, anchored near the trigger button.
 *
 * @example
 * ```tsx
 * <FontSizePopover
 *   anchorRect={buttonRect}
 *   onClose={() => setOpen(false)}
 * />
 * ```
 */

import { useEffect, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import { useBookStore } from "@/stores/useBookStore";

/** Preset font sizes for quick selection */
const FONT_SIZE_PRESETS = [14, 16, 18, 20, 24, 28];

/** Min/max bounds */
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 32;
const STEP = 2;

interface FontSizePopoverProps {
  /** Bounding rect of the trigger button (for positioning) */
  anchorRect: DOMRect;
  /** Called when popover should close */
  onClose: () => void;
}

export function FontSizePopover({ anchorRect, onClose }: FontSizePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const fontSize = useBookStore((s) => s.ui.fontSize);
  const setFontSize = useBookStore((s) => s.setFontSize);

  // Dismiss on click outside (normal DOM elements)
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

  // Dismiss on iframe click (iframe events don't bubble to parent document)
  useEffect(() => {
    function handleBlur() {
      // When iframe is clicked, focus transfers to iframe
      // Check if the active element is now an iframe
      setTimeout(() => {
        const activeEl = document.activeElement;
        if (activeEl && activeEl.tagName === "IFRAME") {
          onClose();
        }
      }, 0);
    }

    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [onClose]);

  // Dismiss on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleDecrease = () => {
    setFontSize(Math.max(MIN_FONT_SIZE, fontSize - STEP));
  };

  const handleIncrease = () => {
    setFontSize(Math.min(MAX_FONT_SIZE, fontSize + STEP));
  };

  const handlePreset = (size: number) => {
    setFontSize(size);
  };

  // Position: below the anchor, right-aligned
  const top = anchorRect.bottom + 8;
  const right = window.innerWidth - anchorRect.right;

  return (
    <div
      ref={popoverRef}
      className="fixed z-50"
      style={{ top: `${top}px`, right: `${right}px` }}
    >
      <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg shadow-lg overflow-hidden min-w-[200px]">
        {/* Header: current size */}
        <div className="px-3 py-2 border-b border-border dark:border-border-dark">
          <span className="text-xs text-text-secondary dark:text-text-secondary-dark font-sans">
            字体大小
          </span>
        </div>

        {/* +/- controls */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <button
            onClick={handleDecrease}
            disabled={fontSize <= MIN_FONT_SIZE}
            className="w-7 h-7 flex items-center justify-center rounded border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text dark:text-text-dark hover:bg-surface dark:hover:bg-surface-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Minus size={14} />
          </button>

          <span className="text-sm font-medium text-text dark:text-text-dark font-sans tabular-nums min-w-[40px] text-center">
            {fontSize}px
          </span>

          <button
            onClick={handleIncrease}
            disabled={fontSize >= MAX_FONT_SIZE}
            className="w-7 h-7 flex items-center justify-center rounded border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text dark:text-text-dark hover:bg-surface dark:hover:bg-surface-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-border dark:bg-border-dark mx-2" />

        {/* Preset buttons */}
        <div className="px-3 py-2.5">
          <div className="flex flex-wrap gap-1.5">
            {FONT_SIZE_PRESETS.map((size) => {
              const isActive = fontSize === size;
              return (
                <button
                  key={size}
                  onClick={() => handlePreset(size)}
                  className={`px-2 py-1 text-xs font-sans rounded transition-colors cursor-pointer ${
                    isActive
                      ? "bg-accent dark:bg-accent-dark text-white"
                      : "bg-bg dark:bg-bg-dark text-text dark:text-text-dark hover:bg-border dark:hover:bg-border-dark"
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
