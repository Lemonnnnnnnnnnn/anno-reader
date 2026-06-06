/**
 * Tauri invoke wrappers for FTS5 index operations.
 *
 * Bridges TypeScript (camelCase) and Rust (snake_case) types,
 * with proper error handling for all invoke failures.
 */

import { invoke } from "@tauri-apps/api/core";
import type { ChunkInput, SearchResult } from "./types";
import { SEARCH_LIMIT } from "./constants";

// ---------------------------------------------------------------------------
// Internal: Rust-compatible types (snake_case, no extra fields)
// ---------------------------------------------------------------------------

/** Chunk shape expected by the Rust `index_book` command. */
interface RustChunkInput {
  book_id: string;
  chapter_id: string;
  chapter_title: string;
  chunk_text: string;
}

/** Search result row returned by the Rust `search_book` command. */
interface RustSearchResultRow {
  book_id: string;
  chapter_id: string;
  chapter_title: string;
  chunk_text: string;
}

// ---------------------------------------------------------------------------
// Internal: Type conversion
// ---------------------------------------------------------------------------

/** Convert a TypeScript ChunkInput to the snake_case format Rust expects. */
function toRustChunk(chunk: ChunkInput): RustChunkInput {
  return {
    book_id: chunk.bookId,
    chapter_id: chunk.chapterId,
    chapter_title: chunk.chapterTitle,
    chunk_text: chunk.chunkText,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Index a batch of text chunks for a book.
 *
 * Deletes any existing chunks for the book before inserting the new batch,
 * ensuring a clean re-index.
 *
 * @param bookId - The book to index.
 * @param chunks - Array of text chunks to insert into the FTS5 index.
 */
export async function indexBook(
  bookId: string,
  chunks: ChunkInput[]
): Promise<void> {
  try {
    await invoke("index_book", {
      bookId,
      chunks: chunks.map(toRustChunk),
    });
  } catch (error) {
    throw new Error(
      `Failed to index book "${bookId}": ${String(error)}`
    );
  }
}

/**
 * Search indexed chunks for a book.
 *
 * The Rust backend sanitizes the query (wraps in FTS5 double-quotes).
 * Results are truncated to `limit` and assigned a rank based on position.
 *
 * @param bookId - The book to search within.
 * @param query  - The search query string.
 * @param limit  - Maximum number of chunks to return (default: SEARCH_LIMIT).
 * @returns A SearchResult with ranked chunks and metadata.
 */
export async function searchBook(
  bookId: string,
  query: string,
  limit: number = SEARCH_LIMIT
): Promise<SearchResult> {
  try {
    const rows = await invoke<RustSearchResultRow[]>("search_book", {
      bookId,
      query,
    });

    const limited = rows.slice(0, limit);

    return {
      chunks: limited.map((row, index) => ({
        bookId: row.book_id,
        chapterId: row.chapter_id,
        chapterTitle: row.chapter_title,
        chunkText: row.chunk_text,
        rank: index,
      })),
      query,
      totalResults: rows.length,
    };
  } catch (error) {
    throw new Error(
      `Failed to search book "${bookId}": ${String(error)}`
    );
  }
}

/**
 * Delete all indexed chunks for a book.
 *
 * @param bookId - The book whose index should be removed.
 */
export async function deleteBookIndex(bookId: string): Promise<void> {
  try {
    await invoke("delete_book_index", { bookId });
  } catch (error) {
    throw new Error(
      `Failed to delete index for book "${bookId}": ${String(error)}`
    );
  }
}

/**
 * Check whether a book has any indexed chunks.
 *
 * @param bookId - The book to check.
 * @returns `true` if the book has at least one indexed chunk.
 */
export async function bookIndexExists(bookId: string): Promise<boolean> {
  try {
    return await invoke<boolean>("book_index_exists", { bookId });
  } catch (error) {
    throw new Error(
      `Failed to check index for book "${bookId}": ${String(error)}`
    );
  }
}
