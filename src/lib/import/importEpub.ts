/**
 * EPUB import orchestrator (file-level).
 *
 * Combines file reading, EPUB parsing, and store integration for a
 * single EPUB file path. Dialog-based entry point lives in importBook.ts
 * which dispatches by file extension (EPUB / PDF).
 *
 * Books are copied into the data directory as entries/{id}/book.epub,
 * enabling portable data directories for cloud sync across devices.
 */

import { readFileAsArrayBuffer } from "./fileReader";
import { loadEpub } from "@/lib/epub";
import { addEntry, type BookEntry } from "@/lib/bookshelf";
import { useBookStore, type BookMetadata } from "@/stores/useBookStore";
import { EpubImportError, ImportErrorCode } from "./errors";
import { copyBookToDataDir } from "./persist";

/**
 * Result of a successful book import.
 */
export interface ImportResult {
  /** Metadata for the imported book */
  book: BookMetadata;
  /** Path to the imported file */
  filePath: string;
}

/** Maximum file size: 100MB */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

/** Filename for the persisted EPUB copy */
const BOOK_FILENAME = "book.epub";

/**
 * Validate that the file has a valid EPUB extension.
 */
export function validateFileExtension(path: string): void {
  if (!path.toLowerCase().endsWith(".epub")) {
    throw new EpubImportError(
      ImportErrorCode.InvalidFileType,
      `File does not have .epub extension: ${path}`
    );
  }
}

/**
 * Validate that the parsed EPUB has minimum required data.
 */
function validateParsedEpub(parsed: { metadata: { title: string }; chapters: unknown[] }): void {
  // Check for missing title (indicates corrupt or incomplete EPUB)
  if (!parsed.metadata.title || parsed.metadata.title === "Unknown Title") {
    // This is a soft warning - we allow Unknown Title as a fallback
    console.warn("EPUB has no title metadata, using fallback");
  }
}

/**
 * Import an EPUB from an absolute file path: read, parse, copy into the
 * data directory, and register it in the Zustand store + bookshelf.
 *
 * @param filePath - Absolute path to the EPUB file.
 * @returns The imported book metadata and original file path.
 * @throws {EpubImportError} On any failure in the import pipeline.
 */
export async function importEpubFromFile(filePath: string): Promise<ImportResult> {
  // Step 1: Validate file extension
  validateFileExtension(filePath);

  // Step 2: Read file as ArrayBuffer
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await readFileAsArrayBuffer(filePath);
  } catch (err) {
    if (err instanceof EpubImportError) {
      throw err;
    }
    throw new EpubImportError(
      ImportErrorCode.FileReadError,
      `Failed to read file: ${filePath}`,
      err
    );
  }

  // Step 3: Check file size
  if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
    throw new EpubImportError(
      ImportErrorCode.FileTooLarge,
      `File size ${Math.round(arrayBuffer.byteLength / 1024 / 1024)}MB exceeds maximum of 100MB`
    );
  }

  // Step 4: Check minimum file size (EPUBs are ZIP files, minimum ~100 bytes)
  if (arrayBuffer.byteLength < 100) {
    throw new EpubImportError(
      ImportErrorCode.InvalidFileType,
      "File is too small to be a valid EPUB"
    );
  }

  // Step 5: Parse the EPUB
  let parsed;
  try {
    parsed = await loadEpub(arrayBuffer, { extractContent: false });
  } catch (err) {
    // Provide more specific error messages based on the error
    const errMsg = err instanceof Error ? err.message : String(err);

    if (errMsg.includes("ZIP") || errMsg.includes("zip") || errMsg.includes("central directory")) {
      throw new EpubImportError(
        ImportErrorCode.ParseError,
        "The file does not appear to be a valid ZIP archive. EPUB files must be ZIP files.",
        err
      );
    }

    if (errMsg.includes("XML") || errMsg.includes("xml") || errMsg.includes("parse")) {
      throw new EpubImportError(
        ImportErrorCode.ParseError,
        "The EPUB structure is corrupt or uses an unsupported format.",
        err
      );
    }

    throw new EpubImportError(
      ImportErrorCode.ParseError,
      "Failed to parse EPUB file. The file may be corrupt or not a valid EPUB.",
      err
    );
  }

  // Step 6: Validate parsed data
  validateParsedEpub(parsed);

  // Step 7: Copy book to data directory for portability
  const bookId = crypto.randomUUID();
  let persistedPath: string;
  try {
    persistedPath = await copyBookToDataDir(bookId, filePath, BOOK_FILENAME);
  } catch (copyErr) {
    // Non-fatal: fall back to original path if copy fails
    console.warn("Failed to copy book to data directory:", copyErr);
    persistedPath = filePath;
  }

  // Step 8: Build BookMetadata and register in store
  const book: BookMetadata = {
    id: bookId,
    title: parsed.metadata.title,
    author: parsed.metadata.author,
    coverUrl: parsed.coverUrl,
    filePath: persistedPath,
    lastOpened: Date.now(),
    format: "epub",
  };

  useBookStore.getState().setBook(book);

  // Add to library persistence
  const entry: BookEntry = {
    type: "book",
    id: book.id,
    title: book.title,
    author: book.author,
    coverUrl: book.coverUrl,
    filePath: book.filePath,
    format: book.format,
    addedAt: book.lastOpened,
    lastOpened: book.lastOpened,
  };
  await addEntry(entry);

  return { book, filePath };
}
