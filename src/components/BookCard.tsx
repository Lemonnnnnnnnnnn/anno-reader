/**
 * BookCard component.
 *
 * Displays a single book on the bookshelf with cover, title,
 * author, and reading progress. Supports click to open and
 * right-click context menu for removal.
 */

import { useState, useCallback, useEffect } from "react";
import type { BookshelfItem } from "@/lib/bookshelf";
import { Icon } from "@/components/primitives";

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
        className="flex flex-col bg-surface rounded-lg overflow-hidden cursor-pointer transition-all shadow-sm border border-border w-[180px] hover:shadow-md"
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
        <div className="w-full h-60 overflow-hidden bg-bg">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-text-muted">
              <Icon name="book" size={48} />
            </div>
          )}
        </div>

        {/* Book info */}
        <div className="p-3 flex flex-col gap-1">
          <h3 className="m-0 text-sm font-semibold text-text leading-tight truncate" title={book.title}>
            {book.title}
          </h3>
          <p className="m-0 text-xs text-text-secondary truncate" title={book.author}>
            {book.author}
          </p>

          {/* Progress bar */}
          {book.progress && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-200"
                  style={{ width: `${book.progress.percentage}%` }}
                />
              </div>
              <span className="text-[0.7rem] text-text-muted min-w-[32px] text-right">
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
            className="fixed inset-0 z-[999]"
            onClick={handleCloseMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              handleCloseMenu();
            }}
          />
          <div
            className="fixed bg-surface rounded-md shadow-lg border border-border p-1 z-[1000] min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button className="block w-full px-3 py-2 text-[0.8rem] text-text bg-transparent border-none rounded cursor-pointer text-left font-inherit hover:bg-error-bg text-error" onClick={handleRemove}>
              Remove from Bookshelf
            </button>
          </div>
        </>
      )}
    </>
  );
}
