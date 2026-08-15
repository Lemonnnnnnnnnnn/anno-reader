/**
 * PDF page text helpers.
 *
 * Converts pdf.js text content items into:
 * 1. Plain text lines — shared source of truth for both the chapter
 *    HTML content (RAG / AI context) and the viewer's text layer.
 * 2. Escaped HTML — the chapter `content` string in ParsedEpub shape.
 *
 * IMPORTANT: the viewer's text layer is built from the same lines in the
 * same order, so character offsets computed over the text layer DOM match
 * offsets implied by the HTML content. Annotation offsets are always
 * chapter(page)-scoped, which keeps highlights stable.
 */

import type { TextItem } from "pdfjs-dist/types/src/display/api";

/** A single text line extracted from a PDF page. */
export interface PdfTextLine {
  /** The visible text of the line (already trimmed). */
  text: string;
}

/** Extract ordered text lines from pdf.js text content items. */
export function buildTextLines(items: readonly unknown[]): PdfTextLine[] {
  const lines: string[] = [];
  let current = "";

  for (const raw of items) {
    const item = raw as Partial<TextItem>;
    if (typeof item?.str !== "string") continue; // skip TextMarkedContent
    current += item.str;
    if (item.hasEOL) {
      lines.push(current);
      current = "";
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }

  return lines
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .map((text) => ({ text }));
}

/** Escape HTML special characters. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Build the chapter HTML content for a page.
 * One paragraph per non-empty line. Never rendered directly — used by
 * RAG indexing and AI context extraction (plain text is extracted from it).
 */
export function buildPageContentHtml(lines: readonly PdfTextLine[]): string {
  const paragraphs = lines
    .map((line) => `<p>${escapeHtml(line.text)}</p>`)
    .join("\n");
  return `<html><body>${paragraphs}</body></html>`;
}

/** Concatenate lines into the page's full plain text (newline-separated). */
export function linesToPlainText(lines: readonly PdfTextLine[]): string {
  return lines.map((l) => l.text).join("\n");
}

/** Concatenate lines into the page's full plain text joined by spaces. */
export function linesToSpacedText(lines: readonly PdfTextLine[]): string {
  return lines.map((l) => l.text).join(" ");
}
