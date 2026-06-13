import type { EpubChapterInfo } from "@/lib/epub/types";

/**
 * Format a timestamp into a short human-readable string.
 * Example: "May 31, 10:30 AM"
 */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Strip fragment identifier from href (e.g., "chapter1.html#sec2" -> "chapter1.html") */
export function stripFragment(href: string): string {
  return href.split("#")[0];
}

/** Find the chapter index matching a given href */
export function findChapterIndex(
  href: string,
  chapters: EpubChapterInfo[],
): number {
  const stripped = stripFragment(href);
  return chapters.findIndex((ch) => ch.href === stripped);
}
