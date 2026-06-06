/**
 * Types for the RAG (Retrieval-Augmented Generation) module.
 * These types define chunking, search results, and indexing status
 * for full-text search over EPUB content.
 */

// ---------------------------------------------------------------------------
// Chunk Types
// ---------------------------------------------------------------------------

/**
 * Input data for creating a searchable text chunk.
 * Represents a segment of chapter content ready to be indexed.
 */
export interface ChunkInput {
  /** ID of the book this chunk belongs to */
  bookId: string;
  /** ID of the chapter containing this chunk */
  chapterId: string;
  /** Title of the chapter */
  chapterTitle: string;
  /** The text content of this chunk */
  chunkText: string;
  /** Character offset position of this chunk within the chapter */
  position: number;
}

/**
 * A chunk returned from a search query with relevance ranking.
 */
export interface ChunkResult {
  /** ID of the book this chunk belongs to */
  bookId: string;
  /** ID of the chapter containing this chunk */
  chapterId: string;
  /** Title of the chapter */
  chapterTitle: string;
  /** The text content of this chunk */
  chunkText: string;
  /** Relevance rank (lower = more relevant, from FTS5) */
  rank: number;
}

// ---------------------------------------------------------------------------
// Search Types
// ---------------------------------------------------------------------------

/**
 * Complete search result from a RAG query.
 */
export interface SearchResult {
  /** Ranked chunks matching the query */
  chunks: ChunkResult[];
  /** The original search query */
  query: string;
  /** Total number of matching chunks */
  totalResults: number;
}

// ---------------------------------------------------------------------------
// Status Types
// ---------------------------------------------------------------------------

/**
 * Current status of the RAG index for a book.
 */
export interface RAGStatus {
  /** Whether the book has been fully indexed */
  isIndexed: boolean;
  /** Whether indexing is currently in progress */
  isIndexing: boolean;
  /** Total number of chunks in the index */
  chunkCount: number;
  /** Unix timestamp of last successful indexing, null if never indexed */
  lastIndexedAt: number | null;
}
