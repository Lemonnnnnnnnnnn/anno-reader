/**
 * RAG orchestrator — wires chunking → indexing → search → context assembly.
 *
 * Provides the full pipeline for RAG-augmented book conversations:
 * 1. Check if book is indexed
 * 2. Index from parsed EPUB cache if needed
 * 3. Search for relevant chunks
 * 4. Assemble system message with book context
 */

import { chunkBook } from "./chunker";
import { indexBook, bookIndexExists } from "./indexer";
import { getAllChapterTexts } from "./parsed-epub-cache";
import { searchAndAssembleContext, type SearchContextResult } from "./search";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Index a book from the parsed EPUB cache.
 *
 * Gets all chapter texts from the in-memory cache, chunks them,
 * and sends to the Rust backend for FTS5 indexing.
 *
 * Call this before the first search query for a book.
 *
 * @param bookId - The book to index.
 * @throws If the cache is empty or indexing fails.
 */
export async function indexBookFromCache(bookId: string): Promise<void> {
  const chapters = getAllChapterTexts();
  if (chapters.length === 0) {
    throw new Error(
      `Cannot index book "${bookId}": no chapters in parsed EPUB cache. ` +
        "Ensure the book is loaded before indexing.",
    );
  }

  const chunks = chunkBook(bookId, chapters);
  if (chunks.length === 0) {
    throw new Error(
      `Cannot index book "${bookId}": chunking produced no chunks. ` +
        "The book content may be empty or too short.",
    );
  }

  await indexBook(bookId, chunks);
}

/**
 * Ask a question about a book using RAG.
 *
 * Full pipeline:
 * 1. Check if the book has indexed chunks
 * 2. If not, index from the parsed EPUB cache
 * 3. Search for relevant chunks
 * 4. Assemble and return a system message with book context
 *
 * @param bookId     - ID of the book to search.
 * @param query      - The user's question.
 * @param bookTitle  - Title of the book (for the system prompt).
 * @param bookAuthor - Author of the book (for the system prompt).
 * @returns System message with relevant book context.
 */
export async function askQuestion(
  bookId: string,
  query: string,
  bookTitle: string,
  bookAuthor: string,
): Promise<SearchContextResult> {
  // Step 1: Check if indexed
  const indexed = await bookIndexExists(bookId);

  // Step 2: Index if needed
  if (!indexed) {
    await indexBookFromCache(bookId);
  }

  // Step 3: Search + assemble context
  return searchAndAssembleContext(bookId, query, bookTitle, bookAuthor);
}
