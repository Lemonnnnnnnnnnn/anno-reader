/**
 * TocDrawer component.
 *
 * Renders the EPUB table of contents inside a left-side Drawer,
 * with nested indentation up to 3 levels deep.
 * Auto-closes the drawer when a chapter is navigated to.
 *
 * @example
 * ```tsx
 * <TocDrawer
 *   open={tocOpen}
 *   onClose={() => setTocOpen(false)}
 *   toc={toc}
 *   currentChapterHref={currentChapter?.href ?? null}
 *   onNavigate={(href, index) => goToChapter(index)}
 *   chapters={chapters}
 * />
 * ```
 */

import { Drawer } from "@/components/primitives";
import type { EpubTocEntry, EpubChapterInfo } from "@/lib/epub/types";

interface TocDrawerProps {
  /** Whether the drawer is visible */
  open: boolean;
  /** Callback to close the drawer */
  onClose: () => void;
  /** Table of contents entries (possibly nested) */
  toc: EpubTocEntry[];
  /** Href of the currently active chapter, or null */
  currentChapterHref: string | null;
  /** Callback when a TOC entry is clicked */
  onNavigate: (href: string, index: number) => void;
  /** All chapters for href-to-index resolution */
  chapters: EpubChapterInfo[];
}

interface TocEntryProps {
  entry: EpubTocEntry;
  level: number;
  currentChapterHref: string | null;
  onNavigate: (href: string, index: number) => void;
  onClose: () => void;
  chapters: EpubChapterInfo[];
}

const MAX_LEVEL = 3;

/** Tailwind padding classes per indentation level */
const LEVEL_PADDING = ["pl-4", "pl-8", "pl-12"] as const;

/** Strip fragment identifier from href (e.g., "chapter1.html#sec2" -> "chapter1.html") */
function stripFragment(href: string): string {
  return href.split("#")[0];
}

/** Find the chapter index matching a given href */
function findChapterIndex(
  href: string,
  chapters: EpubChapterInfo[],
): number {
  const stripped = stripFragment(href);
  return chapters.findIndex((ch) => ch.href === stripped);
}

/** Recursive TOC entry renderer with auto-close on navigate */
function TocEntry({
  entry,
  level,
  currentChapterHref,
  onNavigate,
  onClose,
  chapters,
}: TocEntryProps) {
  const strippedHref = stripFragment(entry.href);
  const isActive = currentChapterHref === strippedHref;

  const handleClick = () => {
    const index = findChapterIndex(entry.href, chapters);
    if (index !== -1) {
      onNavigate(strippedHref, index);
      onClose();
    }
  };

  return (
    <>
      <button
        className={`w-full text-left text-sm pr-3 py-1.5 rounded-md cursor-pointer border-none bg-transparent transition-colors ${LEVEL_PADDING[level] ?? "pl-4"} ${
          isActive
            ? "bg-accent/10 text-accent font-medium"
            : "text-text hover:bg-border/50"
        }`}
        onClick={handleClick}
        title={entry.title}
      >
        {entry.title}
      </button>
      {level < MAX_LEVEL - 1 &&
        entry.children?.map((child, i) => (
          <TocEntry
            key={`${child.href}-${i}`}
            entry={child}
            level={level + 1}
            currentChapterHref={currentChapterHref}
            onNavigate={onNavigate}
            onClose={onClose}
            chapters={chapters}
          />
        ))}
    </>
  );
}

export function TocDrawer({
  open,
  onClose,
  toc,
  currentChapterHref,
  onNavigate,
  chapters,
}: TocDrawerProps) {
  return (
    <Drawer open={open} onClose={onClose} side="left" title="Table of Contents">
      {toc.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-6 text-center">
          <p className="m-0 text-sm text-text-secondary">
            No table of contents
          </p>
        </div>
      ) : (
        <nav className="flex flex-col gap-0.5">
          {toc.map((entry, i) => (
            <TocEntry
              key={`${entry.href}-${i}`}
              entry={entry}
              level={0}
              currentChapterHref={currentChapterHref}
              onNavigate={onNavigate}
              onClose={onClose}
              chapters={chapters}
            />
          ))}
        </nav>
      )}
    </Drawer>
  );
}
