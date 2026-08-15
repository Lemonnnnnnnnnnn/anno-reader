/**
 * Dialog-based book import entry point.
 *
 * Opens a native file dialog and dispatches by file extension to the
 * EPUB or PDF importer. This is the single high-level import function
 * used by UI pages.
 */

import { openFileDialog } from "./dialog";
import { importEpubFromFile, type ImportResult } from "./importEpub";
import { importPdfFromFile } from "./importPdf";
import { EpubImportError, ImportErrorCode } from "./errors";

/**
 * Open a file dialog, then import the selected book (EPUB or PDF).
 *
 * @returns The imported book metadata and original file path.
 * @throws {EpubImportError} If the dialog is cancelled, the extension is
 *         unsupported, or any importer step fails.
 */
export async function importBook(): Promise<ImportResult> {
  const filePath = await openFileDialog();

  if (filePath.toLowerCase().endsWith(".pdf")) {
    return importPdfFromFile(filePath);
  }

  if (filePath.toLowerCase().endsWith(".epub")) {
    return importEpubFromFile(filePath);
  }

  throw new EpubImportError(
    ImportErrorCode.InvalidFileType,
    `Unsupported file type: ${filePath}`
  );
}
