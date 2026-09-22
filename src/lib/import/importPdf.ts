/**
 * PDF import orchestrator (file-level).
 *
 * Reads a PDF, validates it, extracts metadata + cover, copies it into
 * the data directory as entries/{id}/book.pdf, and registers it in the
 * Zustand store + bookshelf. Mirrors importEpub.ts structure.
 */

import { readFileAsArrayBuffer } from "./fileReader";
import { loadPdf, titleFromFilePath, destroyPdfDocument } from "@/lib/pdf";
import { addEntry, type BookEntry } from "@/lib/bookshelf";
import { useBookStore, type BookMetadata } from "@/stores/useBookStore";
import { EpubImportError, ImportErrorCode } from "./errors";
import { bookFileName, persistBookCopy } from "./persist";
import type { ImportResult } from "./importEpub";
import { MAX_FILE_SIZE } from "./importEpub";

/** Minimum plausible PDF size: 5 bytes for the %PDF- header */
const MIN_PDF_SIZE = 5;

/**
 * Validate that the file has a valid PDF extension.
 */
export function validatePdfExtension(path: string): void {
  if (!path.toLowerCase().endsWith(".pdf")) {
    throw new EpubImportError(
      ImportErrorCode.InvalidFileType,
      `File does not have .pdf extension: ${path}`
    );
  }
}

/**
 * Import a PDF from an absolute file path: read, validate, extract
 * metadata/cover, copy into the data directory, and register it in the
 * Zustand store + bookshelf.
 *
 * Page text is NOT extracted here (extractContent: false) — the reader
 * extracts it lazily when the book is opened.
 *
 * @param filePath - Absolute path to the PDF file.
 * @returns The imported book metadata (read it from `book.filePath`).
 * @throws {EpubImportError} On any failure in the import pipeline.
 */
export async function importPdfFromFile(filePath: string): Promise<ImportResult> {
  // Step 1: Validate file extension
  validatePdfExtension(filePath);

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

  // Step 4: Check minimum file size
  if (arrayBuffer.byteLength < MIN_PDF_SIZE) {
    throw new EpubImportError(
      ImportErrorCode.InvalidFileType,
      "File is too small to be a valid PDF"
    );
  }

  // Step 5: Parse the PDF (metadata + cover only; %PDF- magic is validated inside)
  let parsed;
  try {
    const pdfBook = await loadPdf(arrayBuffer, {
      extractContent: false,
      generateCover: true,
    });
    parsed = pdfBook.parsed;
    // Release the worker document — the reader re-opens from the persisted copy
    await destroyPdfDocument(pdfBook.document).catch(() => undefined);
  } catch (err) {
    if (err instanceof EpubImportError) {
      throw err;
    }
    throw new EpubImportError(
      ImportErrorCode.ParseError,
      `Failed to parse PDF file: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }

  // Step 6: Copy book to data directory for portability
  const bookId = crypto.randomUUID();
  const { filePath: persistedPath } = await persistBookCopy(
    bookId,
    filePath,
    bookFileName("pdf")
  );

  // Step 7: Build BookMetadata and register in store
  // (prefer PDF-embedded title; fall back to filename)
  const title =
    parsed.metadata.title && parsed.metadata.title !== "Untitled PDF"
      ? parsed.metadata.title
      : titleFromFilePath(filePath);

  const book: BookMetadata = {
    id: bookId,
    title,
    author: parsed.metadata.author,
    coverUrl: parsed.coverUrl,
    filePath: persistedPath,
    lastOpened: Date.now(),
    format: "pdf",
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

  return { book };
}
