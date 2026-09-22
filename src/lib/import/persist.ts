/**
 * Shared persistence helpers for book imports.
 *
 * Books are copied into the data directory as entries/{id}/book.{ext},
 * enabling portable data directories for cloud sync across devices.
 */

import { copyFile, mkdir, exists } from "@tauri-apps/plugin-fs";
import { readConfig } from "@/lib/storage/config";
import { EpubImportError, ImportErrorCode } from "./errors";

/**
 * Canonical filename for a book's persisted copy inside entries/{id}/.
 */
export function bookFileName(format: "epub" | "pdf"): string {
  return `book.${format}`;
}

/**
 * Copy a book file into the data directory under entries/{id}/{filename}.
 *
 * @param bookId - The book's unique ID.
 * @param srcPath - Absolute path to the source book file.
 * @param filename - Persisted filename, e.g. "book.epub" or "book.pdf".
 * @returns The relative path (entries/{id}/{filename}) for storage in bookshelf.
 * @throws {EpubImportError} If the data directory is not configured or copy fails.
 */
export async function copyBookToDataDir(
  bookId: string,
  srcPath: string,
  filename: string
): Promise<string> {
  const config = await readConfig();
  if (!config?.dataDir) {
    throw new EpubImportError(
      ImportErrorCode.FileReadError,
      "Data directory not configured"
    );
  }

  const entryDir = `${config.dataDir}/entries/${bookId}`;
  const dirExists = await exists(entryDir);
  if (!dirExists) {
    await mkdir(entryDir, { recursive: true });
  }

  const destPath = `${entryDir}/${filename}`;
  await copyFile(srcPath, destPath);

  // Return relative path for portability
  return `entries/${bookId}/${filename}`;
}

/** Outcome of persisting an imported book. */
export interface PersistedBookCopy {
  /** Path to read the book from — entries/{id}/{filename} when copied. */
  filePath: string;
  /** Whether the copy into the data directory succeeded. */
  copied: boolean;
}

/**
 * Copy a book into the data directory, falling back to the original path
 * when the copy fails.
 *
 * The fallback keeps the book readable, but a book read straight from its
 * original path breaks as soon as that file moves or the app loses read
 * access to it (e.g. macOS-protected folders such as ~/Documents). Callers
 * should therefore treat `copied: false` as a warning rather than a success —
 * `ensurePersistedCopy()` retries the copy the next time the book is opened.
 *
 * @param bookId - The book's unique ID.
 * @param srcPath - Absolute path to the source book file.
 * @param filename - Persisted filename, e.g. "book.epub" or "book.pdf".
 */
export async function persistBookCopy(
  bookId: string,
  srcPath: string,
  filename: string
): Promise<PersistedBookCopy> {
  try {
    return { filePath: await copyBookToDataDir(bookId, srcPath, filename), copied: true };
  } catch (err) {
    console.warn(
      `Failed to copy book into the data directory — reading ${srcPath} instead. ` +
        "The copy is retried the next time the book is opened; until it succeeds the " +
        "book cannot be read once that file moves or becomes unreadable.",
      err
    );
    return { filePath: srcPath, copied: false };
  }
}
