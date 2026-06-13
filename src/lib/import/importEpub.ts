/**
 * Main EPUB import orchestrator.
 *
 * Combines file dialog, file reading, EPUB parsing, and store integration
 * into a single high-level import flow. Handles various error scenarios
 * gracefully with user-friendly messages.
 */

import { openFileDialog } from "./dialog";
import { readFileAsArrayBuffer } from "./fileReader";
import { loadEpub } from "@/lib/epub";
import { addEntry, type BookEntry } from "@/lib/bookshelf";
import { useBookStore, type BookMetadata } from "@/stores/useBookStore";
import { EpubImportError, ImportErrorCode } from "./errors";

/**
 * Result of a successful EPUB import.
 */
export interface ImportResult {
  /** Metadata for the imported book */
  book: BookMetadata;
  /** Path to the imported file */
  filePath: string;
}

/** Maximum file size: 100MB */
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * Validate that the file has a valid EPUB extension.
 */
function validateFileExtension(path: string): void {
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
 * Open a file dialog, read the selected EPUB file, parse it,
 * and register it in the Zustand store.
 *
 * @returns The imported book metadata and file path.
 * @throws {EpubImportError} On any failure in the import pipeline.
 */
export async function importEpub(): Promise<ImportResult> {
  // Step 1: Open file dialog
  let filePath: string;
  try {
    filePath = await openFileDialog();
  } catch (err) {
    // Re-throw as-is (already EpubImportError with Cancelled code)
    throw err;
  }

  // Step 2: Validate file extension
  validateFileExtension(filePath);

  // Step 3: Read file as ArrayBuffer
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

  // Step 4: Check file size
  if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
    throw new EpubImportError(
      ImportErrorCode.FileTooLarge,
      `File size ${Math.round(arrayBuffer.byteLength / 1024 / 1024)}MB exceeds maximum of 100MB`
    );
  }

  // Step 5: Check minimum file size (EPUBs are ZIP files, minimum ~100 bytes)
  if (arrayBuffer.byteLength < 100) {
    throw new EpubImportError(
      ImportErrorCode.InvalidFileType,
      "File is too small to be a valid EPUB"
    );
  }

  // Step 6: Parse the EPUB
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

  // Step 7: Validate parsed data
  validateParsedEpub(parsed);

  // Step 8: Build BookMetadata and register in store
  const book: BookMetadata = {
    id: crypto.randomUUID(),
    title: parsed.metadata.title,
    author: parsed.metadata.author,
    coverUrl: parsed.coverUrl,
    filePath,
    lastOpened: Date.now(),
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
    addedAt: book.lastOpened,
    lastOpened: book.lastOpened,
  };
  await addEntry(entry);

  return { book, filePath };
}
