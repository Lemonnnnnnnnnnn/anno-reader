/**
 * PDF module.
 *
 * Adds PDF support to anno-reader by mapping PDFs onto the application's
 * ParsedEpub shape (pages as chapters), so annotations, progress, RAG,
 * AI translation, and summaries work without downstream changes.
 *
 * Rendering (canvas + text layer) lives in components/PdfViewer.
 */

export {
  loadPdf,
  getPageText,
  validatePdfMagic,
  titleFromFilePath,
  destroyPdfDocument,
  PdfFormatError,
  PdfNoPagesError,
} from "./loader";
export {
  buildTextLines,
  buildPageContentHtml,
  escapeHtml,
  linesToPlainText,
  linesToSpacedText,
  type PdfTextLine,
} from "./text";
export { outlineToToc, type RawOutlineItem, type DestResolver } from "./outline";
export { renderPdfCover } from "./cover";
export { loadPdfjs } from "./setup";
export {
  PAGE_HREF_PREFIX,
  pageHref,
  pageNumberFromHref,
  type PdfBook,
  type LoadPdfOptions,
} from "./types";
