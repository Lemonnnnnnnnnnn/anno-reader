/**
 * EPUB parser module.
 *
 * Provides functions for loading and parsing EPUB files using epubix.
 *
 * @example
 * ```ts
 * import { loadEpub } from "@/lib/epub";
 *
 * const arrayBuffer = await file.arrayBuffer();
 * const { metadata, coverUrl, chapters, toc } = await loadEpub(arrayBuffer);
 * ```
 */

export { loadEpub, extractMetadata, extractCover, extractChapters, extractToc, resolveHref } from "./parser";

export type {
  EpubMetadata,
  EpubChapterInfo,
  EpubTocEntry,
  ParsedEpub,
  LoadEpubOptions,
} from "./types";

// Resource resolution utilities (shared by CSS, images, fonts)
export {
  normalizePath,
  resolveRelativePath,
  resolvePath,
  findResourceByHref,
  extractFilename,
} from "./resource-resolver";
