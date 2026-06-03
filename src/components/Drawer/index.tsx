/**
 * Reusable Drawer component.
 *
 * Fixed right-side panel (400px) with slide-in animation, backdrop overlay,
 * Escape key handling, and optional outside-click-to-close behavior.
 * Pure container — no tab logic or domain-specific content.
 *
 * @example
 * ```tsx
 * <Drawer isOpen={open} onClose={() => setOpen(false)} title="Settings">
 *   <SettingsContent />
 * </Drawer>
 * ```
 */

import { type ReactNode, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/primitives";

export interface DrawerProps {
  /** Whether the drawer is visible */
  isOpen: boolean;
  /** Callback when the drawer should close */
  onClose: () => void;
  /** Optional title displayed in the header bar */
  title?: string;
  /** Drawer content */
  children: ReactNode;
  /** Whether clicking the backdrop closes the drawer (default: true) */
  closeOnOutsideClick?: boolean;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  closeOnOutsideClick = true,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape key handler
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleEscape]);

  // Backdrop click handler
  const handleBackdropClick = useCallback(() => {
    if (closeOnOutsideClick) onClose();
  }, [closeOnOutsideClick, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-300"
        onClick={handleBackdropClick}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 bottom-0 w-[400px] max-w-full bg-surface dark:bg-surface-dark border-l border-border dark:border-border-dark shadow-lg z-50 flex flex-col transform transition-transform duration-300 ease-in-out translate-x-0"
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
