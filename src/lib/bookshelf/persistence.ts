/**
 * Bookshelf persistence layer using Tauri filesystem plugin.
 *
 * Stores bookshelf data as a single JSON file in the app's data directory.
 */

import {
  readTextFile,
  writeTextFile,
  mkdir,
  exists,
} from "@tauri-apps/plugin-fs";
import { readConfig } from "@/lib/storage/config";
import type { BookMetadata } from "@/stores/useBookStore";
import type { BookshelfData } from "./types";

/** Filename for bookshelf data within the data directory */
const BOOKSHELF_FILE = "bookshelf.json";

/**
 * Get the full path to the bookshelf file.
 */
async function getBookshelfPath(): Promise<string> {
  const config = await readConfig();
  if (!config) {
    throw new Error("Data directory not configured");
  }
  return `${config.dataDir}/${BOOKSHELF_FILE}`;
}

/**
 * Load all books from the bookshelf file.
 *
 * @returns Array of book metadata, or empty array if file doesn't exist.
 */
export async function loadBookshelf(): Promise<BookMetadata[]> {
  try {
    const filePath = await getBookshelfPath();
    const fileExists = await exists(filePath);

    if (!fileExists) {
      return [];
    }

    const json = await readTextFile(filePath);
    const data = JSON.parse(json) as BookshelfData;

    return Array.isArray(data.books) ? data.books : [];
  } catch (err) {
    console.error("Failed to load bookshelf:", err);
    return [];
  }
}

/**
 * Save all books to the bookshelf file.
 *
 * @param books - Array of book metadata to persist.
 */
export async function saveBookshelf(books: BookMetadata[]): Promise<void> {
  const config = await readConfig();
  if (!config) {
    throw new Error("Data directory not configured");
  }

  // Ensure data directory exists
  const dirExists = await exists(config.dataDir);
  if (!dirExists) {
    await mkdir(config.dataDir, { recursive: true });
  }

  const filePath = await getBookshelfPath();
  const data: BookshelfData = { books };
  const json = JSON.stringify(data, null, 2);
  await writeTextFile(filePath, json);
}

/**
 * Add a single book to the bookshelf.
 *
 * @param book - Book metadata to add.
 */
export async function addBookToBookshelf(book: BookMetadata): Promise<void> {
  const books = await loadBookshelf();
  const existingIndex = books.findIndex((b) => b.id === book.id);

  if (existingIndex >= 0) {
    // Update existing book
    books[existingIndex] = book;
  } else {
    // Add new book
    books.push(book);
  }

  await saveBookshelf(books);
}

/**
 * Remove a single book from the bookshelf.
 *
 * @param bookId - ID of the book to remove.
 */
export async function removeBookFromBookshelf(bookId: string): Promise<void> {
  const books = await loadBookshelf();
  const filtered = books.filter((b) => b.id !== bookId);
  await saveBookshelf(filtered);
}

/**
 * Update a book's metadata in the bookshelf.
 *
 * @param bookId - ID of the book to update.
 * @param updates - Partial metadata to merge.
 */
export async function updateBookInBookshelf(
  bookId: string,
  updates: Partial<BookMetadata>
): Promise<void> {
  const books = await loadBookshelf();
  const index = books.findIndex((b) => b.id === bookId);

  if (index >= 0) {
    books[index] = { ...books[index], ...updates };
    await saveBookshelf(books);
  }
}
