/**
 * Types for the EPUB parser module.
 * These are our application-level types, decoupled from epubix internals.
 */

/** Metadata extracted from an EPUB file */
export interface EpubMetadata {
  title: string;
  author: string;
  language: string;
  identifier: string;
}

/** A single chapter with its content */
export interface EpubChapterInfo {
  /** Unique identifier from spine idref */
  id: string;
  /** Display title (from manifest or TOC) */
  title: string;
  /** Relative href within the EPUB (e.g., "Text/chapter1.xhtml") */
  href: string;
  /** Raw HTML content of the chapter */
  content: string;
  /** CSS content extracted from this chapter (inline styles + linked stylesheets) */
  cssContent: string[];
}

/** A table of contents entry, possibly nested */
export interface EpubTocEntry {
  /** Display title */
  title: string;
  /** href (may include fragment, e.g., "chapter1.html#section2") */
  href: string;
  /** Nested sub-entries */
  children?: EpubTocEntry[];
}

/** The result of parsing an EPUB file */
export interface ParsedEpub {
  /** Book metadata */
  metadata: EpubMetadata;
  /** Cover image as a data URL (e.g., "data:image/jpeg;base64,..."), or null if no cover */
  coverUrl: string | null;
  /** Chapters in spine (reading) order */
  chapters: EpubChapterInfo[];
  /** Table of contents (possibly nested) */
  toc: EpubTocEntry[];
}

/** Options for loading an EPUB */
export interface LoadEpubOptions {
  /** Whether to extract chapter content (default: true). Set false for metadata-only. */
  extractContent?: boolean;
}
