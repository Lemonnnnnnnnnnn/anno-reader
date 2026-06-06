/**
 * SessionItem component.
 *
 * Displays a single conversation session with title, last updated time,
 * and action buttons for rename and delete. Supports inline editing
 * and delete confirmation flows.
 *
 * @example
 * ```tsx
 * <SessionItem
 *   title="Chapter 3 discussion"
 *   updatedAt={Date.now()}
 *   isActive={true}
 *   onRename={(newTitle) => rename(id, newTitle)}
 *   onDelete={() => remove(id)}
 *   onClick={() => select(id)}
 * />
 * ```
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/primitives";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SessionItemProps {
  /** Display title for this conversation */
  title: string;
  /** Unix timestamp (ms) when the conversation was last updated */
  updatedAt: number;
  /** Whether this is the currently active conversation */
  isActive: boolean;
  /** Called when the user saves a new title via inline edit */
  onRename: (newTitle: string) => void;
  /** Called when the user confirms deletion */
  onDelete: () => void;
  /** Called when the user clicks the session row (not on action buttons) */
  onClick: () => void;
}

// ---------------------------------------------------------------------------
// Timestamp Formatting
// ---------------------------------------------------------------------------

/**
 * Format a Unix timestamp (ms) into a relative or short date string.
 * Shows "Today" / "Yesterday" / short date for older sessions.
 */
function formatUpdatedAt(updatedAt: number): string {
  const date = new Date(updatedAt);
  const now = new Date();

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionItem({
  title,
  updatedAt,
  isActive,
  onRename,
  onDelete,
  onClick,
}: SessionItemProps) {
  // --- Inline edit state ---
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Delete confirmation state ---
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Sync editValue when title prop changes externally
  useEffect(() => {
    setEditValue(title);
  }, [title]);

  // -----------------------------------------------------------------------
  // Edit handlers
  // -----------------------------------------------------------------------

  const enterEditMode = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditValue(title);
      setIsEditing(true);
      setIsConfirmingDelete(false);
    },
    [title],
  );

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onRename(trimmed);
    }
    setIsEditing(false);
  }, [editValue, title, onRename]);

  const cancelEdit = useCallback(() => {
    setEditValue(title);
    setIsEditing(false);
  }, [title]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    },
    [commitEdit, cancelEdit],
  );

  // -----------------------------------------------------------------------
  // Delete handlers
  // -----------------------------------------------------------------------

  const enterDeleteConfirm = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsConfirmingDelete(true);
      setIsEditing(false);
    },
    [],
  );

  const confirmDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete();
    },
    [onDelete],
  );

  const cancelDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsConfirmingDelete(false);
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Click handler — only fires when not editing / confirming
  // -----------------------------------------------------------------------

  const handleClick = useCallback(() => {
    if (isEditing || isConfirmingDelete) return;
    onClick();
  }, [isEditing, isConfirmingDelete, onClick]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        group w-full text-left rounded-lg px-3 py-2.5 transition-colors cursor-pointer
        ${isActive
          ? "bg-accent/10 dark:bg-accent-dark/10"
          : "hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Left: title + timestamp */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onBlur={commitEdit}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-sm font-sans text-text dark:text-text-dark
                         bg-surface dark:bg-surface-dark
                         border border-accent dark:border-accent-dark
                         rounded px-1.5 py-0.5 outline-none"
            />
          ) : (
            <p className="text-sm font-sans text-text dark:text-text-dark truncate">
              {title}
            </p>
          )}
          <p className="mt-0.5 text-[0.72rem] text-text-muted dark:text-text-muted-dark">
            {formatUpdatedAt(updatedAt)}
          </p>
        </div>

        {/* Right: action buttons (visible on hover or active) */}
        {!isEditing && !isConfirmingDelete && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              variant="icon"
              size="sm"
              onClick={enterEditMode}
              aria-label="Rename conversation"
              className="text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="icon"
              size="sm"
              onClick={enterDeleteConfirm}
              aria-label="Delete conversation"
              className="text-text-secondary dark:text-text-secondary-dark hover:text-error dark:hover:text-error-dark"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Delete confirmation overlay */}
        {isConfirmingDelete && (
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-error dark:text-error-dark font-sans whitespace-nowrap">
              Delete?
            </span>
            <Button
              variant="icon"
              size="sm"
              onClick={confirmDelete}
              aria-label="Confirm delete"
              className="text-error dark:text-error-dark hover:bg-error-bg dark:hover:bg-error-bg-dark"
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="icon"
              size="sm"
              onClick={cancelDelete}
              aria-label="Cancel delete"
              className="text-text-secondary dark:text-text-secondary-dark"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </button>
  );
}
