/**
 * Reusable Modal component.
 *
 * Centered dialog with backdrop overlay and Escape key handling.
 * Pure container — no domain-specific content.
 *
 * @example
 * ```tsx
 * <Modal open={open} onClose={() => setOpen(false)} title="Edit Metadata">
 *   <EditForm />
 * </Modal>
 * ```
 */

import { type ReactNode, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/primitives";

export interface ModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** Optional title displayed in the header bar */
  title?: string;
  /** Modal content */
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-surface dark:bg-surface-dark rounded-lg shadow-xl border border-border dark:border-border-dark flex flex-col">
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
    </div>
  );
}
