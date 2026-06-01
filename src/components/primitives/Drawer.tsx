import { type ReactNode, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/primitives";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  title: string;
  children: ReactNode;
}

export function Drawer({
  open,
  onClose,
  side = "right",
  title,
  children,
}: DrawerProps) {
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

  const slideFrom = side === "left" ? "left-0" : "right-0";
  const translateHidden =
    side === "left" ? "-translate-x-full" : "translate-x-full";

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`absolute inset-y-0 ${slideFrom} w-96 max-w-full bg-surface shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : translateHidden
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-medium text-text font-sans">{title}</h2>
          <Button variant="icon" onClick={onClose} aria-label="Close drawer">
            <X size={18} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
