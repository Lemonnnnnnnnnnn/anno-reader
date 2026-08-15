/**
 * PDF outline → EPUB TOC mapping.
 *
 * Converts the pdf.js outline (bookmarks tree) into EpubTocEntry[]
 * with page hrefs ("page-{n}") so the existing TocDrawer renders it
 * unchanged.
 */

import type { EpubTocEntry } from "@/lib/epub/types";
import { pageHref } from "./types";

/** Raw pdf.js outline item (subset of fields we consume). */
export interface RawOutlineItem {
  title: string | undefined;
  dest: unknown;
  items?: RawOutlineItem[];
}

/** Resolves an outline dest to a 1-based page number, or null. */
export type DestResolver = (dest: unknown) => Promise<number | null>;

/**
 * Convert a raw pdf.js outline tree into EpubTocEntry[].
 * Entries whose dest cannot be resolved to a page are dropped.
 */
export async function outlineToToc(
  outline: readonly RawOutlineItem[] | null,
  resolveDest: DestResolver,
  depth = 0,
): Promise<EpubTocEntry[]> {
  if (!outline || outline.length === 0 || depth >= 3) return [];

  const entries: EpubTocEntry[] = [];
  for (const item of outline) {
    const title = (item.title ?? "").trim();
    const pageNumber = await resolveDest(item.dest);
    if (!title || pageNumber === null) continue;

    const children = await outlineToToc(item.items ?? [], resolveDest, depth + 1);

    entries.push({
      title,
      href: pageHref(pageNumber),
      ...(children.length > 0 ? { children } : {}),
    });
  }
  return entries;
}
