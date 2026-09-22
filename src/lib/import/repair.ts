/**
 * Repair bookshelf entries that still point at their original source path.
 *
 * Imports copy the book into the data directory as entries/{id}/book.{ext}
 * so that reading never depends on the original file. Entries created before
 * that existed — and entries whose copy failed — still store an absolute
 * source path; those break as soon as the source moves or the app cannot read
 * it (e.g. macOS-protected folders such as ~/Documents).
 *
 * `ensurePersistedCopy()` retro-fits the copy when such a book is opened.
 */

import { isAbsolutePath } from "./fileReader";
import { bookFileName, persistBookCopy } from "./persist";
import {
  formatFromFilePath,
  useBookStore,
  type BookMetadata,
} from "@/stores/useBookStore";
import { useBookshelfStore } from "@/stores/useBookshelfStore";

/**
 * Ensure a book has a copy inside the data directory and return the path to
 * read it from.
 *
 * Books already persisted (relative path) are returned untouched. Books that
 * still reference their original absolute path are copied into the data
 * directory, and both the bookshelf entry and the open book are updated; if
 * the copy fails the original path is returned so the book stays readable.
 *
 * @param book - Book metadata as stored in the bookshelf.
 * @returns The path to read the book from — relative when persisted.
 */
export async function ensurePersistedCopy(book: BookMetadata): Promise<string> {
  if (!isAbsolutePath(book.filePath)) {
    return book.filePath;
  }

  const format = book.format ?? formatFromFilePath(book.filePath);
  const { filePath, copied } = await persistBookCopy(
    book.id,
    book.filePath,
    bookFileName(format),
  );

  if (!copied) {
    return filePath;
  }

  // Persist the new path on the entry, then keep the open book in sync — but
  // only when it is the book being repaired.
  await useBookshelfStore.getState().updateBook(book.id, { filePath });
  if (useBookStore.getState().currentBook?.id === book.id) {
    useBookStore.getState().updateBookMetadata({ filePath });
  }

  return filePath;
}
