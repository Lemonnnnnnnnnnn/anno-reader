/**
 * EPUB import module.
 *
 * Provides functions for importing EPUB files via native file dialog,
 * reading them from disk, and registering them in the application store.
 *
 * Includes comprehensive error handling with user-friendly messages
 * for various failure scenarios (corrupt files, missing resources, etc.).
 *
 * @example
 * ```ts
 * import { importEpub, EpubImportError } from "@/lib/import";
 *
 * try {
 *   const { book, filePath } = await importEpub();
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
export { importEpub } from "./importEpub";
export type { ImportResult } from "./importEpub";
export { EpubImportError, ImportErrorCode, ERROR_MESSAGES } from "./errors";
