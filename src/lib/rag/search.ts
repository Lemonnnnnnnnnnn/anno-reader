/**
 * Search orchestrator for RAG-based book conversations.
 *
 * Sanitizes user queries for FTS5, executes searches,
 * and assembles retrieved chunks into a system prompt context.
 */

import { searchBook } from "./indexer";
import type { ChunkResult } from "./types";
import { SYSTEM_PROMPT_TEMPLATE } from "./constants";

// ---------------------------------------------------------------------------
// Query Sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitize a user query for safe FTS5 phrase matching.
 *
 * - Wraps the entire query in double quotes for phrase search
 * - Escapes any internal `"` by doubling them (`"` → `""`)
 *
 * This prevents FTS5 syntax errors from reserved characters
 * (`, *, OR, AND, NOT, NEAR, ^) while keeping the query as a
 * single phrase for precise matching.
 *
 * @param query - Raw user input.
 * @returns FTS5-safe quoted phrase string.
 */
export function sanitizeFTS5Query(query: string): string {
  const escaped = query.replace(/"/g, '""');
  return `"${escaped}"`;
}

// ---------------------------------------------------------------------------
// Context Assembly
// ---------------------------------------------------------------------------

/**
 * Build a context string from search results, grouped by chapter.
 *
 * Each chapter section uses the chapter title as a header,
 * followed by the matched chunk texts.
 *
 * @param chunks - Ranked chunks from a search.
 * @returns Assembled context string for the system prompt.
 */
function assembleContext(chunks: ChunkResult[]): string {
  // Group chunks by chapter title, preserving rank order within groups
  const groups = new Map<string, string[]>();

  for (const chunk of chunks) {
    const existing = groups.get(chunk.chapterTitle);
    if (existing) {
      existing.push(chunk.chunkText);
    } else {
      groups.set(chunk.chapterTitle, [chunk.chunkText]);
    }
  }

  // Format each chapter group with its title as header
  const sections: string[] = [];
  for (const [title, texts] of groups) {
    sections.push(`[${title}]\n${texts.join("\n")}`);
  }

  return sections.join("\n\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Result of a search + context assembly operation. */
export interface SearchContextResult {
  /** System message with book context injected into the template. */
  systemMessage: string;
  /** The ranked chunks returned by the search. */
  chunks: ChunkResult[];
}

/**
 * Search a book and assemble the results into a system message
 * ready for RAG-augmented chat.
 *
 * Flow:
 * 1. Sanitize the user query for FTS5
 * 2. Execute the search via the Rust backend
 * 3. Assemble matched chunks into a context string
 * 4. Build the system message from the template
 *
 * @param bookId    - ID of the book to search.
 * @param query     - Raw user question.
 * @param bookTitle - Title of the book (for the system prompt).
 * @param bookAuthor - Author of the book (for the system prompt).
 * @returns System message and raw chunks. Returns a fallback
 *          system message when no chunks are found.
 */
export async function searchAndAssembleContext(
  bookId: string,
  query: string,
  bookTitle: string,
  bookAuthor: string,
): Promise<SearchContextResult> {
  const sanitized = sanitizeFTS5Query(query);
  const result = await searchBook(bookId, sanitized);

  // Graceful handling: no results → still provide a usable system message
  if (result.chunks.length === 0) {
    const systemMessage = SYSTEM_PROMPT_TEMPLATE.replace(
      "{bookTitle}",
      bookTitle,
    )
      .replace("{bookAuthor}", bookAuthor)
      .replace("{context}", "(No relevant passages found in the book.)");

    return { systemMessage, chunks: [] };
  }

  const context = assembleContext(result.chunks);
  const systemMessage = SYSTEM_PROMPT_TEMPLATE.replace(
    "{bookTitle}",
    bookTitle,
  )
    .replace("{bookAuthor}", bookAuthor)
    .replace("{context}", context);

  return { systemMessage, chunks: result.chunks };
}
