/**
 * Reusable Modal component.
 *
 * Centered dialog with backdrop overlay and Escape key handling.
 * Rendered in a portal on `document.body` so it stays centered in the
 * viewport even when mounted inside a transformed/overflow-hidden ancestor
 * (e.g. a Drawer panel). Pure container — no domain-specific content.
 *
 * @example
 * ```tsx
 * <Modal open={open} onClose={() => setOpen(false)} title="Edit Metadata">
 *   <EditForm />
 * </Modal>
 * ```
 */

import { type ReactNode, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/primitives";

export interface ModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** Optional title displayed in the header bar */
  title?: string;
  /** Whether clicking the backdrop closes the modal (default: true) */
  closeOnOutsideClick?: boolean;
  /** Panel width preset (default: "md") */
  size?: "md" | "wide";
  /** Modal content */
  children: ReactNode;
}

const sizeClasses = {
  md: "max-w-md",
  wide: "max-w-2xl",
};

export function Modal({
  open,
  onClose,
  title,
  closeOnOutsideClick = true,
  size = "md",
  children,
}: ModalProps) {
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-200"
        onClick={handleBackdropClick}
      />

      {/* Panel */}
      <div
        className={`relative w-full ${sizeClasses[size]} bg-surface dark:bg-surface-dark rounded-lg shadow-xl border border-border dark:border-border-dark flex flex-col`}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-border dark:border-border-dark shrink-0">
            <h2 className="text-base font-medium text-text dark:text-text-dark font-sans m-0">
              {title}
            </h2>
            <Button variant="icon" onClick={onClose} aria-label="Close dialog">
              <X size={18} />
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
