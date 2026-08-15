/**
 * Book import module.
 *
 * Provides functions for importing books (EPUB / PDF) via native file
 * dialog, reading them from disk, and registering them in the store.
 *
 * Includes comprehensive error handling with user-friendly messages
 * for various failure scenarios (corrupt files, missing resources, etc.).
 *
 * @example
 * ```ts
 * import { importBook, EpubImportError } from "@/lib/import";
 *
 * try {
 *   const { book, filePath } = await importBook();
 *   console.log(`Imported: ${book.title}`);
 * } catch (err) {
 *   if (err instanceof EpubImportError) {
 *     // Display user-friendly message
 *     showError(err.userMessage);
 *   }
 * }
 * ```
 */

export { openFileDialog } from "./dialog";
export { readFileAsArrayBuffer } from "./fileReader";
export { importBook } from "./importBook";
export { importEpubFromFile, MAX_FILE_SIZE } from "./importEpub";
export { importPdfFromFile, validatePdfExtension } from "./importPdf";
export { copyBookToDataDir } from "./persist";
export type { ImportResult } from "./importEpub";
export { EpubImportError, ImportErrorCode, ERROR_MESSAGES } from "./errors";
