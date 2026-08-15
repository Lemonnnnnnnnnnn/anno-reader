/**
 * Main PDF loader.
 *
 * Loads a PDF via pdf.js and maps it onto the application's ParsedEpub
 * shape (see types.ts for the mapping rationale). Downstream systems
 * (RAG, AI translation, summaries, annotations, progress, TOC) consume
 * the ParsedEpub view unchanged; PdfViewer uses the live document handle
 * for canvas rendering.
 */

import type { PDFDocumentProxy } from "pdfjs-dist";
import type { RefProxy } from "pdfjs-dist/types/src/display/api";
import type { ParsedEpub, EpubChapterInfo, EpubMetadata, EpubTocEntry } from "@/lib/epub/types";
import { EpubImportError, ImportErrorCode } from "@/lib/import/errors";
import { loadPdfjs } from "./setup";
import { outlineToToc, type RawOutlineItem } from "./outline";
import { buildTextLines, buildPageContentHtml, linesToSpacedText } from "./text";
import { renderPdfCover } from "./cover";
import { pageHref, type PdfBook, type LoadPdfOptions } from "./types";

/** %PDF- magic header shared by all PDF files. */
const PDF_MAGIC = "%PDF-";

/** Thrown when the data is not a PDF. */
export class PdfFormatError extends EpubImportError {
  constructor(message: string, cause?: unknown) {
    super(ImportErrorCode.InvalidFileType, message, cause);
    this.name = "PdfFormatError";
  }
}

/** Thrown when the PDF has no pages. */
export class PdfNoPagesError extends EpubImportError {
  constructor(message: string, cause?: unknown) {
    super(ImportErrorCode.NoChapters, message, cause);
    this.name = "PdfNoPagesError";
  }
}

/**
 * Validate that an ArrayBuffer starts with the %PDF- magic bytes.
 * @throws {PdfFormatError} If the magic header is missing.
 */
export function validatePdfMagic(data: ArrayBuffer): void {
  const header = new TextDecoder("latin1").decode(
    new Uint8Array(data, 0, Math.min(5, data.byteLength)),
  );
  if (header !== PDF_MAGIC) {
    throw new PdfFormatError(
      `File does not start with %PDF- magic header (got: ${JSON.stringify(header)})`,
    );
  }
}

/** Derive a display title from a file path (used when metadata is empty). */
export function titleFromFilePath(filePath: string): string {
  const base = filePath.replace(/[\\/]/g, "/").split("/").pop() ?? "";
  const withoutExt = base.replace(/\.pdf$/i, "");
  return withoutExt.trim() || "Untitled PDF";
}

/** Build the metadata view from pdf.js info + filename fallback. */
function buildMetadata(
  info: { Title?: string; Author?: string; Language?: string; PDFFilename?: string } | undefined,
  fallbackTitle: string,
): EpubMetadata {
  const title = (info?.Title ?? "").trim() || fallbackTitle;
  const author = (info?.Author ?? "").trim() || "Unknown Author";
  const language = (info?.Language ?? "").trim();
  return {
    title,
    author,
    language,
    identifier: (info?.PDFFilename ?? "").trim(),
  };
}

/**
 * Build the chapters array: one chapter per page.
 * With extractContent=false, page text is skipped (empty content) —
 * used for fast metadata-only import.
 */
async function buildPageChapters(
  doc: PDFDocumentProxy,
  extractContent: boolean,
): Promise<EpubChapterInfo[]> {
  const chapters: EpubChapterInfo[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    let content = "";
    if (extractContent) {
      try {
        const page = await doc.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const lines = buildTextLines(textContent.items as readonly unknown[]);
        if (lines.length > 0) {
          content = buildPageContentHtml(lines);
        }
      } catch (err) {
        // A single unreadable page should not fail the whole load
        console.warn(`[pdf] Failed to extract text from page ${pageNumber}:`, err);
      }
    }

    chapters.push({
      id: pageHref(pageNumber),
      title: `Page ${pageNumber}`,
      href: pageHref(pageNumber),
      content,
      cssContent: [],
    });
  }

  return chapters;
}

/** Type guard for pdf.js page reference proxies ({ num, gen }). */
function isRefProxy(value: unknown): value is RefProxy {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RefProxy).num === "number" &&
    typeof (value as RefProxy).gen === "number"
  );
}

/**
 * Resolve a pdf.js outline dest to a 1-based page number.
 * Handles both string destinations (named dests) and explicit arrays.
 */
async function makeDestResolver(
  doc: PDFDocumentProxy,
): Promise<(dest: unknown) => Promise<number | null>> {
  // Cache named destinations to avoid repeated lookups
  const namedDests = new Map<string, unknown[] | null>();

  return async (dest: unknown): Promise<number | null> => {
    try {
      let explicit: readonly unknown[] | null = null;

      if (typeof dest === "string") {
        if (!namedDests.has(dest)) {
          const resolved = await doc.getDestinations();
          namedDests.set(dest, resolved.get(dest) ?? null);
        }
        explicit = namedDests.get(dest) ?? null;
      } else if (Array.isArray(dest)) {
        explicit = dest;
      }

      if (!explicit || explicit.length === 0) return null;

      const ref = explicit[0];
      if (!isRefProxy(ref)) return null;

      const pageIndex = await doc.getPageIndex(ref);
      return pageIndex + 1;
    } catch (err) {
      console.warn("[pdf] Failed to resolve outline dest:", dest, err);
      return null;
    }
  };
}

/**
 * Destroy a loaded PDF document and release its worker.
 * pdf.js 6.x exposes destroy() on the loading task, not the proxy.
 */
export function destroyPdfDocument(doc: PDFDocumentProxy): Promise<void> {
  return doc.loadingTask.destroy();
}

/**
 * Load a PDF and map it onto the ParsedEpub shape.
 *
 * @param data - Raw PDF bytes (consumed by pdf.js — pass a copy if reuse needed).
 * @param options - See LoadPdfOptions.
 * @returns PdfBook with the ParsedEpub view and the live document handle.
 * @throws {PdfFormatError} If data lacks the %PDF- magic.
 * @throws {PdfNoPagesError} If the document has zero pages.
 */
export async function loadPdf(
  data: ArrayBuffer,
  options: LoadPdfOptions = {},
): Promise<PdfBook> {
  const { extractContent = true, generateCover = false } = options;

  validatePdfMagic(data);

  // pdf.js transfers the underlying buffer to the worker — copy defensively
  const bufferCopy = data.slice(0);

  const pdfjsLib = await loadPdfjs();
  const task = pdfjsLib.getDocument({
    data: new Uint8Array(bufferCopy),
  });
  const doc = await task.promise.catch((err: unknown) => {
    throw new PdfFormatError(
      `Failed to parse PDF: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  });

  if (doc.numPages < 1) {
    await doc.loadingTask.destroy();
    throw new PdfNoPagesError("The PDF document contains no pages");
  }

  // Metadata (title/author) with filename fallback
  const meta = await doc.getMetadata().catch(() => null);
  const info = (meta?.info ?? undefined) as
    | { Title?: string; Author?: string; Language?: string; PDFFilename?: string }
    | undefined;
  const fallbackTitle =
    (info?.Title ?? "").trim() || (info?.PDFFilename ?? "").trim() || "Untitled PDF";
  const metadata = buildMetadata(info, fallbackTitle);

  // Chapters: one per page
  const chapters = await buildPageChapters(doc, extractContent);

  // TOC from outline (bookmarks), if any
  const rawOutline = (await doc.getOutline().catch(() => null)) as
    | RawOutlineItem[]
    | null;
  const toc: EpubTocEntry[] = rawOutline
    ? await outlineToToc(rawOutline, await makeDestResolver(doc))
    : [];

  // Optional cover from page 1
  const coverUrl = generateCover ? await renderPdfCover(doc) : null;

  const parsed: ParsedEpub = {
    metadata,
    coverUrl,
    chapters,
    toc,
    resources: {},
    opfFolder: "",
    manifestHrefs: {},
  };

  return { parsed, document: doc };
}

/**
 * Get the plain text of a single page (space-joined lines) for AI context.
 * Used by the viewer/translation layer without re-walking the HTML content.
 */
export async function getPageText(
  doc: PDFDocumentProxy,
  pageNumber: number,
): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const lines = buildTextLines(textContent.items as readonly unknown[]);
  return linesToSpacedText(lines);
}
