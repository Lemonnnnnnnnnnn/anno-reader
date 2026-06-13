import { useCallback } from "react";
import { Button } from "@/components/primitives";
import { Trash2 } from "lucide-react";
import { deleteHighlight } from "@/lib/annotations";
import { formatTimestamp, findChapterIndex } from "./utils";
import type { HighlightItemProps } from "./types";

/** Single highlight card inside the drawer with delete action. */
export function HighlightItem({ highlight, onNavigate, onClose, chapters }: HighlightItemProps) {
  const truncatedText =
    highlight.text.length > 80 ? `${highlight.text.slice(0, 80)}\u2026` : highlight.text;

  const handleNavigate = useCallback(() => {
    const index = findChapterIndex(highlight.chapterHref, chapters);
    if (index !== -1) {
      onNavigate(highlight.chapterHref, index, highlight.cfiRange);
      onClose();
    }
  }, [highlight.chapterHref, highlight.cfiRange, chapters, onNavigate, onClose]);

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteHighlight(highlight.id, highlight.bookId);
  }, [highlight.id, highlight.bookId]);

  return (
    <div className="border border-border dark:border-border-dark rounded-lg bg-surface-alt dark:bg-surface-alt-dark">
      {/* Main content — clickable to navigate */}
      <button
        type="button"
        onClick={handleNavigate}
        className="w-full text-left p-3 cursor-pointer bg-transparent border-none transition-colors hover:bg-surface dark:hover:bg-surface-dark rounded-t-lg"
      >
        {/* Color indicator + text */}
        <div className="flex gap-2">
          <span
            className="w-1 shrink-0 rounded-full"
            style={{ backgroundColor: highlight.color }}
          />
          <p className="m-0 text-sm text-text dark:text-text-dark leading-relaxed overflow-hidden text-ellipsis line-clamp-3 break-words">
            {truncatedText}
          </p>
        </div>

        {/* Timestamp */}
        <span className="mt-2 block text-[0.72rem] text-text-muted dark:text-text-muted-dark">
          {formatTimestamp(highlight.createdAt)}
        </span>
      </button>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-0.5 px-2 pb-2">
        <Button
          variant="icon"
          onClick={handleDelete}
          title="Delete highlight"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}
