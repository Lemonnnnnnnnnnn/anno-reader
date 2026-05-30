/**
 * BookCard component.
 *
 * Displays a single book on the bookshelf with cover, title,
 * author, and reading progress. Supports click to open and
 * right-click context menu for removal.
 */

import { useState, useCallback, useEffect } from "react";
import type { BookshelfItem } from "@/lib/bookshelf";

interface BookCardProps {
  book: BookshelfItem;
  onClick: (book: BookshelfItem) => void;
  onRemove: (bookId: string) => void;
}

export function BookCard({ book, onClick, onRemove }: BookCardProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleClick = useCallback(() => {
    onClick(book);
  }, [book, onClick]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleRemove = useCallback(() => {
    setContextMenu(null);
    onRemove(book.id);
  }, [book.id, onRemove]);

  const handleCloseMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Close context menu on Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [contextMenu]);

  return (
    <>
      <div
        style={styles.card}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {/* Cover image */}
        <div style={styles.coverContainer}>
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              style={styles.coverImage}
              loading="lazy"
            />
          ) : (
            <div style={styles.coverPlaceholder}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
          )}
        </div>

        {/* Book info */}
        <div style={styles.info}>
          <h3 style={styles.title} title={book.title}>
            {book.title}
          </h3>
          <p style={styles.author} title={book.author}>
            {book.author}
          </p>

          {/* Progress bar */}
          {book.progress && (
            <div style={styles.progressContainer}>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${book.progress.percentage}%`,
                  }}
                />
              </div>
              <span style={styles.progressText}>
                {Math.round(book.progress.percentage)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            style={styles.overlay}
            onClick={handleCloseMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              handleCloseMenu();
            }}
          />
          <div
            style={{
              ...styles.contextMenu,
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            <button style={styles.menuItem} onClick={handleRemove}>
              Remove from Bookshelf
            </button>
          </div>
        </>
      )}
    </>
  );
}

// --- Design tokens (aligned with project palette) ---

const colors = {
  surface: "#ffffff",
  text: "#0f0f0f",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  border: "#e5e5e5",
  accent: "#374151",
  progressBg: "#e5e5e5",
  progressFill: "#374151",
  menuBg: "#ffffff",
  menuHover: "#f3f4f6",
  overlay: "rgba(0, 0, 0, 0.1)",
} as const;

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: "flex",
    flexDirection: "column",
    background: colors.surface,
    borderRadius: "8px",
    overflow: "hidden",
    cursor: "pointer",
    transition: "transform 0.15s, box-shadow 0.15s",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
    border: `1px solid ${colors.border}`,
    width: "180px",
  },
  coverContainer: {
    width: "100%",
    height: "240px",
    overflow: "hidden",
    background: "#f9fafb",
  },
  coverImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  coverPlaceholder: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    color: colors.textMuted,
  },
  info: {
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  title: {
    margin: 0,
    fontSize: "0.875rem",
    fontWeight: 600,
    color: colors.text,
    lineHeight: 1.3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  author: {
    margin: 0,
    fontSize: "0.75rem",
    color: colors.textSecondary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  progressContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "4px",
  },
  progressBar: {
    flex: 1,
    height: "4px",
    background: colors.progressBg,
    borderRadius: "2px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: colors.progressFill,
    borderRadius: "2px",
    transition: "width 0.2s",
  },
  progressText: {
    fontSize: "0.7rem",
    color: colors.textMuted,
    minWidth: "32px",
    textAlign: "right",
  },
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  contextMenu: {
    position: "fixed",
    background: colors.menuBg,
    borderRadius: "6px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    border: `1px solid ${colors.border}`,
    padding: "4px",
    zIndex: 1000,
    minWidth: "180px",
  },
  menuItem: {
    display: "block",
    width: "100%",
    padding: "8px 12px",
    fontSize: "0.8rem",
    color: colors.text,
    background: "transparent",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
  },
};
