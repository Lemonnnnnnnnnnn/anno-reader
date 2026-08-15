/**
 * Types for the PDF module.
 *
 * PDFs are mapped onto the application's ParsedEpub shape so that
 * downstream systems (RAG indexing, AI translation, summaries,
 * annotations, reading progress, TOC) work without modification:
 *
 * - Each PDF page becomes one "chapter" (href: "page-{n}").
 * - The PDF outline becomes the table of contents.
 * - Page text becomes the chapter HTML content (used for RAG/AI, never
 *   rendered directly — pages render via canvas in PdfViewer).
 */

import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ParsedEpub } from "@/lib/epub/types";

/** A loaded PDF book: ParsedEpub-compatible view + live document handle. */
export interface PdfBook {
  /** ParsedEpub-shaped view of the PDF (pages as chapters). */
  parsed: ParsedEpub;
  /** Live pdf.js document handle for canvas rendering in PdfViewer. */
  document: PDFDocumentProxy;
}

/** Options for loadPdf. */
export interface LoadPdfOptions {
  /**
   * Whether to extract text content for every page (default: true).
   * Set false for metadata-only import (faster for huge documents).
   */
  extractContent?: boolean;
  /** Whether to render page 1 as a cover data URL (default: false). */
  generateCover?: boolean;
}

/** Prefix used for page chapter hrefs ("page-1", "page-2", ...). */
export const PAGE_HREF_PREFIX = "page-";

/** Build the chapter href for a 1-based PDF page number. */
export function pageHref(pageNumber: number): string {
  return `${PAGE_HREF_PREFIX}${pageNumber}`;
}

/** Extract the 1-based page number from a page chapter href, or null. */
export function pageNumberFromHref(href: string): number | null {
  if (!href.startsWith(PAGE_HREF_PREFIX)) return null;
  const n = parseInt(href.slice(PAGE_HREF_PREFIX.length), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
