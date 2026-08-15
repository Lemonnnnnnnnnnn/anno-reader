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
