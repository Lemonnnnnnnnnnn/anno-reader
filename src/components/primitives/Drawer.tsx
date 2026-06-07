/**
 * Reusable Drawer component.
 *
 * Fixed side panel (left or right) with slide-in animation, backdrop overlay,
 * Escape key handling, and optional outside-click-to-close behavior.
 * Pure container — no domain-specific content.
 *
 * @example
 * ```tsx
 * <Drawer open={open} onClose={() => setOpen(false)} title="Settings">
 *   <SettingsContent />
 * </Drawer>
 * ```
 */

import { type ReactNode, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/primitives";

export interface DrawerProps {
  /** Whether the drawer is visible */
  open: boolean;
  /** Callback when the drawer should close */
  onClose: () => void;
  /** Which side the drawer slides from (default: "right") */
  side?: "left" | "right";
  /** Optional title displayed in the header bar */
  title?: string;
  /** Whether clicking the backdrop closes the drawer (default: true) */
  closeOnOutsideClick?: boolean;
  /** Drawer content */
  children: ReactNode;
}

export function Drawer({
  open,
  onClose,
  side = "right",
  title,
  closeOnOutsideClick = true,
  children,
}: DrawerProps) {
  // Escape key handler
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, handleEscape]);

  // Backdrop click handler
  const handleBackdropClick = useCallback(() => {
    if (closeOnOutsideClick) onClose();
  }, [closeOnOutsideClick, onClose]);

  if (!open) return null;

  const slideFrom = side === "left" ? "left-0" : "right-0";
  const translateHidden =
    side === "left" ? "-translate-x-full" : "translate-x-full";

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-300"
        onClick={handleBackdropClick}
      />

      {/* Panel */}
      <div
        className={`absolute inset-y-0 ${slideFrom} w-96 max-w-full bg-surface dark:bg-surface-dark shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : translateHidden
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-border-dark shrink-0">
          {title && (
            <h2 className="text-lg font-medium text-text dark:text-text-dark font-sans">{title}</h2>
          )}
          <Button
            variant="icon"
            onClick={onClose}
            aria-label="Close drawer"
            className={!title ? "ml-auto" : ""}
          >
            <X size={18} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
